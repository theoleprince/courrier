import { useLiveQuery } from 'dexie-react-hooks';
import { useActeur } from '@/hooks/useActeur';
import { corbeille, parapheur, pourInformation } from '@/services/requetes';
import { tachesConfieesA } from '@/services/taches';

export function useMesTaches() {
  const acteur = useActeur();
  return useLiveQuery(async () => {
    if (!acteur) return { corbeille: 0, parapheur: 0, information: 0 };
    const [c, p, info, confiees] = await Promise.all([
      corbeille(acteur.poste.id),
      parapheur(acteur.poste.id),
      pourInformation(acteur.poste.id),
      tachesConfieesA(acteur.poste.id),
    ]);
    return { corbeille: c.length + confiees.length, parapheur: p.length, information: info.filter((i) => !i.diffusion.lueLe).length };
  }, [acteur?.poste.id]);
}
