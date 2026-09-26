// @vitest-environment node
// Environnement Node : Blob.arrayBuffer() et crypto.subtle réels, nécessaires aux empreintes des pièces jointes.
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { viderDb } from '@/tests/dbTestUtils';
import { validerEtape } from '@/services/workflow';
import { annulerTache, confierTache, rendreCompte, tachesConfieesA } from '@/services/taches';
import { niveauAcces } from '@/services/requetes';
import type { CircuitInstance, Courrier, EtapeInstance } from '@/types/models';

afterEach(viderDb);

const dg = { personneId: 'paul', posteId: 'poste-dg' };
const assistante = { personneId: 'nadege', posteId: 'poste-assistante' };

function etape(ordre: number, type: EtapeInstance['type'], statut: EtapeInstance['statut'], posteAssigneId?: string): EtapeInstance {
  return { ordre, type, libelle: type, delaiJours: 1, sauterSiRedacteur: false, statut, posteAssigneId } as EtapeInstance;
}

/** Entrant confidentiel arrivé à l'étape « Validation » du DG. */
async function preparer(): Promise<void> {
  await db.postes.bulkPut([
    { id: 'poste-dg', libelle: 'Directeur général', entiteId: 'dg', role: 'DG', estResponsable: true, peutSigner: true, actif: true },
    { id: 'poste-assistante', libelle: 'Assistante de direction', entiteId: 'dg', role: 'AGENT', estResponsable: false, peutSigner: false, actif: true },
  ]);
  await db.circuits.put({
    id: 'circuit',
    courrierId: 'entrant',
    modeleId: 'modele',
    etapes: [etape(1, 'IMPUTATION', 'VALIDEE'), etape(2, 'VALIDATION', 'EN_COURS', 'poste-dg')],
    indexCourant: 1,
    posteCourantId: 'poste-dg',
    statut: 'EN_COURS',
    demarreLe: '2026-09-01T00:00:00.000Z',
  } as CircuitInstance);
  await db.courriers.put({
    id: 'entrant',
    sens: 'ENTRANT',
    statut: 'EN_VALIDATION',
    codeSuivi: 'ENT-1',
    confidentialite: 'CONFIDENTIEL',
    creeParId: 'carine',
    reponseAttendue: false,
    circuitInstanceId: 'circuit',
  } as unknown as Courrier);
}

describe('tâches confiées', () => {
  it("le DG confie le travail à son assistante, qui rend compte, puis le DG valide son étape", async () => {
    await preparer();

    const tache = await confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'Préparer un projet de réponse', delaiJours: 2 });

    // L'assistante voit la tâche dans sa corbeille et accède au courrier confidentiel.
    expect((await tachesConfieesA('poste-assistante')).map((e) => e.tache.id)).toEqual([tache.id]);
    const courrier = (await db.courriers.get('entrant'))!;
    expect(await niveauAcces(courrier, { personne: { id: 'nadege' }, poste: { id: 'poste-assistante', role: 'AGENT' } } as never)).toBe('COMPLET');
    expect((await db.notifications.where('posteId').equals('poste-assistante').toArray()).map((n) => n.type)).toContain('TACHE_CONFIEE');

    // L'étape reste au DG et ne peut pas être close tant que la tâche est ouverte.
    await expect(validerEtape('circuit', dg)).rejects.toThrow('erreurs.tacheConfieeEnCours');
    expect((await db.circuits.get('circuit'))?.posteCourantId).toBe('poste-dg');

    await rendreCompte(tache.id, assistante, {
      texte: 'Projet joint',
      fichier: { blob: new Blob(['projet']), nom: 'projet.txt', mime: 'text/plain' },
    });
    const rendue = await db.tachesConfiees.get(tache.id);
    expect(rendue?.statut).toBe('RENDUE');
    expect(rendue?.pieceJointeId).toBeTruthy();
    expect(await tachesConfieesA('poste-assistante')).toEqual([]);
    expect((await db.notifications.where('posteId').equals('poste-dg').toArray()).map((n) => n.type)).toContain('COMPTE_RENDU');

    await validerEtape('circuit', dg);
    expect((await db.circuits.get('circuit'))?.statut).toBe('TERMINE');

    const actions = (await db.historique.where('courrierId').equals('entrant').toArray()).map((h) => h.action);
    expect(actions).toEqual(expect.arrayContaining(['TACHE_CONFIEE', 'COMPTE_RENDU', 'VALIDATION']));
  });

  it("seul le titulaire de l'étape peut confier, et seul le destinataire peut rendre compte", async () => {
    await preparer();

    await expect(confierTache('circuit', assistante, { posteDestinataireId: 'poste-dg', note: 'x' })).rejects.toThrow('erreurs.posteNonAssigne');
    await expect(confierTache('circuit', dg, { posteDestinataireId: 'poste-dg', note: 'x' })).rejects.toThrow('erreurs.confierASoiMeme');
    await expect(confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: '  ' })).rejects.toThrow('erreurs.noteObligatoire');

    const tache = await confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'À traiter' });
    await expect(rendreCompte(tache.id, dg, { texte: 'fait' })).rejects.toThrow('erreurs.posteNonAssigne');
    await expect(rendreCompte(tache.id, assistante, { texte: ' ' })).rejects.toThrow('erreurs.compteRenduObligatoire');
  });

  it('le DG peut reprendre la main en annulant la tâche', async () => {
    await preparer();
    const tache = await confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'À traiter' });

    await expect(annulerTache(tache.id, assistante)).rejects.toThrow('erreurs.posteNonAssigne');
    await annulerTache(tache.id, dg);

    expect((await db.tachesConfiees.get(tache.id))?.statut).toBe('ANNULEE');
    await expect(rendreCompte(tache.id, assistante, { texte: 'trop tard' })).rejects.toThrow('erreurs.tacheIntrouvable');
    await validerEtape('circuit', dg);
    expect((await db.circuits.get('circuit'))?.statut).toBe('TERMINE');
  });
});
