import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { viderDb } from '@/tests/dbTestUtils';
import { ACTEUR_SYSTEME, EMPREINTE_GENESE, tracer, verifierJournal } from '@/services/journal';

afterEach(viderDb);

describe('journal chaîné', () => {
  it('chaîne les empreintes successives à partir de la genèse', async () => {
    const premiere = await tracer({
      courrierId: 'courrier-1',
      action: 'ENREGISTREMENT',
      acteurId: 'personne-1',
      posteId: 'poste-1',
    });
    expect(premiere.sequence).toBe(1);
    expect(premiere.empreintePrecedente).toBe(EMPREINTE_GENESE);

    const seconde = await tracer({
      courrierId: 'courrier-1',
      action: 'IMPUTATION',
      acteurId: ACTEUR_SYSTEME,
      posteId: 'poste-2',
      details: { entiteTraitanteId: 'entite-1' },
    });
    expect(seconde.sequence).toBe(2);
    expect(seconde.empreintePrecedente).toBe(premiere.empreinte);
    expect(seconde.empreinte).not.toBe(premiere.empreinte);
  });

  it('verifierJournal() valide une chaîne intacte', async () => {
    for (let i = 0; i < 5; i++) {
      await tracer({
        courrierId: 'courrier-1',
        action: 'COMMENTAIRE',
        acteurId: 'personne-1',
        posteId: 'poste-1',
        commentaire: `étape ${i}`,
      });
    }
    const resultat = await verifierJournal();
    expect(resultat.valide).toBe(true);
    expect(resultat.entreesVerifiees).toBe(5);
  });

  it('détecte une falsification et localise la première entrée corrompue', async () => {
    await tracer({ courrierId: 'c1', action: 'ENREGISTREMENT', acteurId: 'p1', posteId: 'po1' });
    const deuxieme = await tracer({ courrierId: 'c1', action: 'TRAITEMENT', acteurId: 'p1', posteId: 'po1' });
    await tracer({ courrierId: 'c1', action: 'VALIDATION', acteurId: 'p1', posteId: 'po1' });

    // Falsification simulée : on modifie directement une entrée ancienne, sans recalculer la chaîne.
    await db.historique.update(deuxieme.id, { commentaire: 'falsifié' });

    const resultat = await verifierJournal();
    expect(resultat.valide).toBe(false);
    expect(resultat.premiereSequenceCorrompue).toBe(deuxieme.sequence);
  });
});
