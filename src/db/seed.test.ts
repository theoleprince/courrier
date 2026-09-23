import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { viderDb } from '@/tests/dbTestUtils';
import { estDejaInitialisee, seedOrganisation } from '@/db/seed';

afterEach(viderDb);

describe('seedOrganisation()', () => {
  it("crée l'organisation, les postes, les personnes et les paramètres", async () => {
    await seedOrganisation();

    const [entites, postes, personnes, parametres] = await Promise.all([
      db.entites.toArray(),
      db.postes.toArray(),
      db.personnes.toArray(),
      db.parametres.get('global'),
    ]);

    expect(entites.length).toBe(9);
    expect(postes.length).toBe(13);
    expect(personnes.length).toBe(13);
    expect(parametres?.nomOrganisation).toBe('Groupe Sanaga Industries');
    expect(parametres?.delaiEscaladeJours).toBe(2);
    expect(parametres?.modeDemo).toBe(true);
  });

  it("respecte les règles d'intégrité de l'organigramme (section 6.1)", async () => {
    await seedOrganisation();
    const entites = await db.entites.toArray();
    const postes = await db.postes.toArray();

    for (const entite of entites) {
      if (entite.type === 'SERVICE') {
        expect(entite.parentId).not.toBeNull();
      }
    }

    const parEntite = new Map<string, number>();
    for (const poste of postes.filter((p) => p.estResponsable)) {
      parEntite.set(poste.entiteId, (parEntite.get(poste.entiteId) ?? 0) + 1);
    }
    for (const compte of parEntite.values()) {
      expect(compte).toBe(1);
    }
  });

  it("place Grâce Eyenga en titulaire comptabilité et intérim RH", async () => {
    await seedOrganisation();
    const grace = (await db.personnes.toArray()).find((p) => p.nom === 'Eyenga');
    expect(grace).toBeDefined();

    const posteTitulaire = await db.postes.get(grace!.posteId!);
    expect(posteTitulaire?.libelle).toBe('Chef du service comptabilité');

    const posteInterim = await db.postes.get(grace!.interimPosteIds[0]);
    expect(posteInterim?.libelle).toBe('Chef du service RH');
  });

  it('est idempotent : un second appel ne duplique rien', async () => {
    await seedOrganisation();
    await seedOrganisation();
    expect(await estDejaInitialisee()).toBe(true);
    expect((await db.entites.toArray()).length).toBe(9);
  });
});
