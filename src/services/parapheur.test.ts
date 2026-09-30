import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { viderDb } from '@/tests/dbTestUtils';
import { enregistrerEntrant, transmettreParapheur } from '@/services/workflow';
import { corbeille, parapheurATransmettre } from '@/services/requetes';
import type { ModeleCircuit, Personne, Poste } from '@/types/models';

afterEach(viderDb);

const carine = { personneId: 'carine', posteId: 'poste-bo' };

async function preparer(): Promise<void> {
  const poste = (id: string, role: Poste['role']): Poste =>
    ({ id, libelle: id, entiteId: 'sg', role, estResponsable: false, peutSigner: false, actif: true });
  await db.postes.bulkPut([poste('poste-bo', 'BUREAU_ORDRE'), poste('poste-sg', 'DIRECTEUR')]);
  await db.personnes.put({ id: 'carine', nom: 'Ngo', prenom: 'Carine', email: '', posteId: 'poste-bo', interimPosteIds: [], actif: true } as Personne);
  const modele: ModeleCircuit = {
    id: 'standard',
    libelle: 'Entrant standard',
    sens: 'ENTRANT',
    typesCourrier: [],
    actif: true,
    etapes: [{ ordre: 1, type: 'IMPUTATION', libelle: 'Imputation', posteCibleId: 'poste-sg', delaiJours: 1, sauterSiRedacteur: false }],
  };
  await db.modelesCircuit.put(modele);
}

async function enregistrer(objet: string, auParapheur: boolean) {
  return enregistrerEntrant(
    { objet, type: 'LETTRE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: 'c1', modeDepot: 'GUICHET', reponseAttendue: false },
    undefined,
    carine,
    { auParapheur },
  );
}

describe('parapheur du bureau d’ordre', () => {
  it('garde les courriers sans démarrer leur circuit, puis les transmet en un lot', async () => {
    await preparer();
    await enregistrer('Premier', true);
    await enregistrer('Second', true);

    const lot = await parapheurATransmettre('poste-bo');
    expect(lot.map((c) => c.objet)).toEqual(['Premier', 'Second']);
    expect(lot.every((c) => c.circuitInstanceId === null)).toBe(true);
    expect(await corbeille('poste-sg')).toHaveLength(0);

    await transmettreParapheur(lot.map((c) => c.id), carine);

    expect(await parapheurATransmettre('poste-bo')).toHaveLength(0);
    const aImputer = await corbeille('poste-sg');
    expect(aImputer.map((t) => t.courrier.objet).sort()).toEqual(['Premier', 'Second']);
    const historique = await db.historique.where('courrierId').equals(lot[0].id).toArray();
    expect(historique.find((h) => h.action === 'TRANSMISSION')?.commentaire).toBe('Parapheur de 2 courrier(s)');
  });

  it('transmet directement si demandé à l’enregistrement', async () => {
    await preparer();
    await enregistrer('Urgent', false);

    expect(await parapheurATransmettre('poste-bo')).toHaveLength(0);
    expect((await corbeille('poste-sg')).map((t) => t.courrier.objet)).toEqual(['Urgent']);
  });

  it('refuse un lot contenant un courrier déjà transmis, sans rien transmettre', async () => {
    await preparer();
    const premier = await enregistrer('Premier', true);
    const second = await enregistrer('Second', true);
    await transmettreParapheur([second.id], carine);

    await expect(transmettreParapheur([premier.id, second.id], carine)).rejects.toThrow('erreurs.pasAuParapheur');
    expect((await parapheurATransmettre('poste-bo')).map((c) => c.objet)).toEqual(['Premier']);
  });

  it('refuse l’enregistrement au parapheur si aucun circuit ne s’applique', async () => {
    await preparer();
    await db.modelesCircuit.update('standard', { actif: false });
    await expect(enregistrer('Sans circuit', true)).rejects.toThrow('erreurs.aucunModeleCircuit');
  });
});
