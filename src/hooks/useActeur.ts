import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useSessionStore } from '@/store/session';
import type { Entite, Personne, Poste } from '@/types/models';

export interface ActeurCourant {
  personne: Personne;
  poste: Poste;
  entite: Entite | undefined;
  enInterim: boolean;
}

/** Personne + poste actif résolus depuis la session, avec lecture réactive Dexie. */
export function useActeur(): ActeurCourant | null | undefined {
  const acteur = useSessionStore((s) => s.acteur);

  return useLiveQuery(async () => {
    if (!acteur) return null;
    const [personne, poste] = await Promise.all([
      db.personnes.get(acteur.personneId),
      db.postes.get(acteur.posteId),
    ]);
    if (!personne || !poste) return null;
    const entite = await db.entites.get(poste.entiteId);
    return {
      personne,
      poste,
      entite,
      enInterim: personne.posteId !== poste.id,
    };
  }, [acteur?.personneId, acteur?.posteId]);
}
