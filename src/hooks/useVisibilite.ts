import { useLiveQuery } from 'dexie-react-hooks';
import { niveauAcces } from '@/services/requetes';
import { useActeur } from '@/hooks/useActeur';
import type { Courrier } from '@/types/models';

export function useVisibilite(courrier: Courrier | undefined) {
  const acteur = useActeur();
  return useLiveQuery(async () => {
    if (!courrier || !acteur) return undefined;
    return niveauAcces(courrier, acteur);
  }, [courrier?.id, courrier?.confidentialite, acteur?.poste.id]);
}
