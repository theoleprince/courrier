import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { viderDb } from '@/tests/dbTestUtils';
import {
  creerEntite,
  desactiverEntite,
  modifierEntite,
  reactiverEntite,
} from '@/services/organisation';

afterEach(viderDb);

async function arbre() {
  const dg = await creerEntite({
    code: 'DG',
    libelle: 'Direction générale',
    type: 'DIRECTION',
    parentId: null,
  });
  const daf = await creerEntite({
    code: 'DAF',
    libelle: 'DAF',
    type: 'DIRECTION',
    parentId: dg.id,
  });
  const cpt = await creerEntite({
    code: 'CPT',
    libelle: 'Comptabilité',
    type: 'SERVICE',
    parentId: daf.id,
  });
  return { dg, daf, cpt };
}

describe('modifierEntite()', () => {
  it('renomme une entité', async () => {
    const { daf } = await arbre();
    await modifierEntite(daf.id, { ...daf, code: 'DFC', libelle: 'Direction financière' });
    const apres = await db.entites.get(daf.id);
    expect(apres?.code).toBe('DFC');
    expect(apres?.libelle).toBe('Direction financière');
  });

  it('refuse un rattachement à elle-même ou à une descendante', async () => {
    const { daf, cpt } = await arbre();
    await expect(modifierEntite(daf.id, { ...daf, parentId: daf.id })).rejects.toThrow(
      'erreurs.parentInvalide',
    );
    await expect(modifierEntite(daf.id, { ...daf, parentId: cpt.id })).rejects.toThrow(
      'erreurs.parentInvalide',
    );
  });

  it('refuse un service sans parent', async () => {
    const { cpt } = await arbre();
    await expect(modifierEntite(cpt.id, { ...cpt, parentId: null })).rejects.toThrow(
      'erreurs.serviceParentObligatoire',
    );
  });
});

describe('reactiverEntite()', () => {
  it('réactive une entité désactivée', async () => {
    const { daf } = await arbre();
    await desactiverEntite(daf.id);
    await reactiverEntite(daf.id);
    expect((await db.entites.get(daf.id))?.actif).toBe(true);
  });

  it('refuse tant que le parent est désactivé', async () => {
    const { daf, cpt } = await arbre();
    await desactiverEntite(daf.id);
    await desactiverEntite(cpt.id);
    await expect(reactiverEntite(cpt.id)).rejects.toThrow('erreurs.parentInactif');
  });
});
