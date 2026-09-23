/** Chemin de base de l'application (ex. « /courrier/ » sur GitHub Pages, « / » en local). */
export const BASE_APP = import.meta.env.BASE_URL;

/** URL absolue de la racine de l'application, sans slash final (origine + chemin de base). */
export function origineApp(): string {
  return `${window.location.origin}${BASE_APP.replace(/\/$/, '')}`;
}
