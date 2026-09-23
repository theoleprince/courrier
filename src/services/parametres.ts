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

/**
 * Convertit une image importée (PNG/JPEG) en data URL PNG, réduite à `tailleMax` px
 * au plus grand côté. Avec `fondTransparent`, les pixels quasi blancs deviennent
 * transparents : un cachet scanné ou photographié sur papier blanc se pose alors
 * proprement sur le document.
 */
export async function imageEnPng(fichier: File, tailleMax: number, fondTransparent = false): Promise<string> {
  const source = await lireFichierEnDataUrl(fichier);
  const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
    const img = new Image();
    img.onload = () => resoudre(img);
    img.onerror = () => rejeter(new Error('Image illisible'));
    img.src = source;
  });
  const echelle = Math.min(1, tailleMax / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * echelle));
  canvas.height = Math.max(1, Math.round(image.height * echelle));
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (fondTransparent) {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) d[i + 3] = 0;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  return canvas.toDataURL('image/png');
}
