import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { viderDb } from '@/tests/dbTestUtils';
import { expedier } from '@/services/workflow';
import type { CircuitInstance, Courrier, EtapeInstance } from '@/types/models';

afterEach(viderDb);

const acteur = { personneId: 'carine', posteId: 'poste-bo' };

function etape(ordre: number, type: EtapeInstance['type'], statut: EtapeInstance['statut']): EtapeInstance {
  return { ordre, type, libelle: type, delaiJours: 1, sauterSiRedacteur: false, statut } as EtapeInstance;
}

/** Entrant resté « en traitement » (personne n'a cliqué « Marquer comme traité ») + sa réponse signée. */
async function preparer(): Promise<void> {
  const circuit = {
    id: 'circuit-entrant',
    courrierId: 'entrant',
    modeleId: 'modele',
    etapes: [etape(1, 'IMPUTATION', 'VALIDEE'), etape(2, 'TRAITEMENT', 'EN_COURS'), etape(3, 'VALIDATION', 'EN_ATTENTE')],
    indexCourant: 1,
    posteCourantId: 'poste-daf',
    statut: 'EN_COURS',
    demarreLe: '2026-09-01T00:00:00.000Z',
  } as CircuitInstance;
  await db.circuits.put(circuit);
  await db.courriers.bulkPut([
    {
      id: 'entrant',
      sens: 'ENTRANT',
      statut: 'EN_TRAITEMENT',
      codeSuivi: 'ENT-1',
      numero: 'ARR-2026-000001',
      reponseAttendue: true,
      circuitInstanceId: circuit.id,
    } as unknown as Courrier,
    {
      id: 'reponse',
      sens: 'SORTANT',
      statut: 'SIGNE',
      codeSuivi: 'SOR-1',
      reponseAId: 'entrant',
      circuitInstanceId: null,
    } as unknown as Courrier,
  ]);
}

describe('expedier()', () => {
  it("clôture l'entrant et solde son circuit, même s'il n'a pas été marqué traité", async () => {
    await preparer();

    const sortant = await expedier('reponse', acteur, { modeEnvoi: 'EMAIL', accuseReception: false });

    expect(sortant.statut).toBe('EXPEDIE');
    expect((await db.courriers.get('entrant'))?.statut).toBe('CLOTURE');
    const circuit = await db.circuits.get('circuit-entrant');
    expect(circuit?.statut).toBe('TERMINE');
    expect(circuit?.etapes.map((e) => e.statut)).toEqual(['VALIDEE', 'VALIDEE', 'IGNOREE']);
    expect(circuit?.etapes[1].commentaire).toBe(`Réponse expédiée : ${sortant.numero}`);
  });
});
