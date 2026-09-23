import { sha256 as sha256Sync_ } from 'js-sha256';

/** Identifiant unique non séquentiel (suffisant pour un POC local). */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Empreinte asynchrone (Web Crypto), pour les fichiers (Blob → ArrayBuffer).
 * Ne JAMAIS attendre cette fonction à l'intérieur d'une transaction Dexie.
 */
export async function sha256(donnees: ArrayBuffer | Blob | string): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof donnees === 'string') {
    buffer = new TextEncoder().encode(donnees).buffer as ArrayBuffer;
  } else if (donnees instanceof Blob) {
    buffer = await donnees.arrayBuffer();
  } else {
    buffer = donnees;
  }
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Empreinte synchrone (js-sha256), utilisée exclusivement pour le journal
 * chaîné car elle peut être appelée à l'intérieur d'une transaction Dexie.
 */
export function sha256Sync(texte: string): string {
  return sha256Sync_(texte);
}

const ALPHABET_CODE_SUIVI = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Code de suivi lisible, format XXXX-XXXX, sans caractères ambigus. */
export function genererCodeSuivi(): string {
  const groupe = () =>
    Array.from({ length: 4 }, () =>
      ALPHABET_CODE_SUIVI.charAt(Math.floor(Math.random() * ALPHABET_CODE_SUIVI.length)),
    ).join('');
  return `${groupe()}-${groupe()}`;
}
