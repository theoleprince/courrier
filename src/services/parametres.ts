import { db } from '@/db/db';
import { invaliderCacheHorloge } from '@/services/horloge';
import type { Parametres } from '@/types/models';

export async function mettreAJourParametres(partiel: Partial<Omit<Parametres, 'id'>>): Promise<void> {
  await db.parametres.update('global', partiel);
  if ('decalageHorlogeMinutes' in partiel) invaliderCacheHorloge();
}

export function lireFichierEnDataUrl(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(lecteur.result as string);
    lecteur.onerror = () => rejeter(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}
