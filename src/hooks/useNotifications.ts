import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useActeur } from '@/hooks/useActeur';
import { postesDisponibles } from '@/services/organisation';

export function useNotifications() {
  const acteur = useActeur();
  return useLiveQuery(async () => {
    if (!acteur) return [];
    const postes = await postesDisponibles(acteur.personne);
    const posteIds = postes.map((p) => p.id);
    if (posteIds.length === 0) return [];
    const tout = await db.notifications.where('posteId').anyOf(posteIds).toArray();
    return tout.sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  }, [acteur?.personne.id]);
}
