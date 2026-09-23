import { db } from '@/db/db';

/** Vide toutes les tables entre deux tests pour les isoler (même instance Dexie / fake-indexeddb). */
export async function viderDb(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}
