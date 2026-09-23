// @vitest-environment node
// Environnement Node : Blob.arrayBuffer() et crypto.subtle réels, nécessaires à pdf-lib et aux empreintes.
import { afterEach, describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { db } from '@/db/db';
import { viderDb } from '@/tests/dbTestUtils';
import { sha256 } from '@/services/crypto';
import { viser } from '@/services/workflow';
import type { CircuitInstance, Courrier, EtapeInstance, PieceJointe } from '@/types/models';

afterEach(viderDb);

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const directeur = { personneId: 'samuel', posteId: 'poste-daf' };

function etape(ordre: number, type: EtapeInstance['type'], statut: EtapeInstance['statut'], posteAssigneId?: string): EtapeInstance {
  return { ordre, type, libelle: type, delaiJours: 1, sauterSiRedacteur: false, statut, posteAssigneId } as EtapeInstance;
}

/** Entrant arrivé à l'étape « Validation du directeur », avec son scan PDF. */
async function preparer(): Promise<void> {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  const contenu = new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
  await db.piecesJointes.put({
    id: 'scan',
    courrierId: 'entrant',
    nom: 'scan.pdf',
    mime: 'application/pdf',
    taille: contenu.size,
    contenu,
    version: 1,
    nature: 'SCAN',
    empreinteSha256: await sha256(contenu),
    ajouteeParId: 'carine',
    ajouteeLe: '2026-09-01T00:00:00.000Z',
  } as PieceJointe);
  await db.postes.put({ id: 'poste-daf', libelle: 'Directeur administratif et financier', entiteId: 'daf', role: 'DIRECTEUR', estResponsable: true, peutSigner: true, actif: true });
  await db.personnes.put({ id: 'samuel', prenom: 'Samuel', nom: 'Tchoupo', email: 's@x', posteId: 'poste-daf', interimPosteIds: [], actif: true });
  await db.circuits.put({
    id: 'circuit',
    courrierId: 'entrant',
    modeleId: 'modele',
    etapes: [etape(1, 'IMPUTATION', 'VALIDEE'), etape(2, 'TRAITEMENT', 'VALIDEE'), etape(3, 'VALIDATION', 'EN_COURS', 'poste-daf')],
    indexCourant: 2,
    posteCourantId: 'poste-daf',
    statut: 'EN_COURS',
    demarreLe: '2026-09-01T00:00:00.000Z',
  } as CircuitInstance);
  await db.courriers.put({
    id: 'entrant',
    sens: 'ENTRANT',
    statut: 'EN_VALIDATION',
    codeSuivi: 'ENT-1',
    reponseAttendue: false,
    circuitInstanceId: 'circuit',
  } as unknown as Courrier);
}

describe('viser() à l’étape « Validation du directeur »', () => {
  it('appose le paraphe sur une nouvelle version du document et valide l’étape', async () => {
    await preparer();

    await viser('circuit', directeur, { paraphePngDataUrl: PNG });

    const pieces = await db.piecesJointes.where('courrierId').equals('entrant').toArray();
    expect(pieces.map((p) => p.version).sort()).toEqual([1, 2]);
    const circuit = await db.circuits.get('circuit');
    expect(circuit?.etapes[2].statut).toBe('VALIDEE');
    expect(circuit?.statut).toBe('TERMINE');
  });
});
