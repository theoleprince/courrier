/** Génère un monogramme PNG (data URL) à partir d'un sigle, pour le logo de démonstration. */
export function genererLogoMonogramme(sigle: string, couleur: string): string {
  const taille = 128;
  const canvas = document.createElement('canvas');
  canvas.width = taille;
  canvas.height = taille;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = couleur;
  const rayon = 24;
  ctx.beginPath();
  ctx.moveTo(rayon, 0);
  ctx.arcTo(taille, 0, taille, taille, rayon);
  ctx.arcTo(taille, taille, 0, taille, rayon);
  ctx.arcTo(0, taille, 0, 0, rayon);
  ctx.arcTo(0, 0, taille, 0, rayon);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initiales = sigle.slice(0, 3).toUpperCase();
  ctx.fillText(initiales, taille / 2, taille / 2 + 4);

  return canvas.toDataURL('image/png');
}

/** Charge le logo officiel livré dans `public/logo.png` sous forme de data URL (undefined si indisponible). */
export async function chargerLogoOfficiel(): Promise<string | undefined> {
  try {
    const reponse = await fetch(`${import.meta.env.BASE_URL}logo.png`);
    if (!reponse.ok) return undefined;
    const blob = await reponse.blob();
    if (blob.type !== 'image/png') return undefined;
    return await new Promise<string>((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(lecteur.result as string);
      lecteur.onerror = () => reject(lecteur.error);
      lecteur.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
