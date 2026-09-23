import { db } from '@/db/db';
import { BASE_APP } from '@/services/urls';

/** Vide la base et recharge l'application ; le seed se rejoue au démarrage. */
export async function reinitialiserDemo(): Promise<void> {
  await db.delete();
  window.location.href = `${BASE_APP}connexion`;
}

async function blobVersBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < bytes.length; i++) binaire += String.fromCharCode(bytes[i]);
  return btoa(binaire);
}

function base64VersBlob(base64: string, mime: string): Blob {
  const binaire = atob(base64);
  const bytes = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) bytes[i] = binaire.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Exporte toutes les tables en JSON (les Blob de `piecesJointes` sont encodés en base64). */
export async function exporterDonnees(): Promise<Blob> {
  const contenu: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    const lignes = await table.toArray();
    if (table.name === 'piecesJointes') {
      contenu[table.name] = await Promise.all(
        lignes.map(async (ligne: Record<string, unknown>) => ({
          ...ligne,
          contenu: await blobVersBase64(ligne.contenu as Blob),
        })),
      );
    } else {
      contenu[table.name] = lignes;
    }
  }
  return new Blob([JSON.stringify(contenu)], { type: 'application/json' });
}

/** Réimporte un export JSON précédent, en remplaçant intégralement le contenu de chaque table. */
export async function importerDonnees(fichier: File): Promise<void> {
  const contenu = JSON.parse(await fichier.text()) as Record<string, Record<string, unknown>[]>;
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      const lignes = contenu[table.name] ?? [];
      if (table.name === 'piecesJointes') {
        await table.bulkAdd(
          lignes.map((ligne) => ({ ...ligne, contenu: base64VersBlob(ligne.contenu as string, ligne.mime as string) })),
        );
      } else if (lignes.length > 0) {
        await table.bulkAdd(lignes);
      }
    }
  });
}
