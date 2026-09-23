import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { Parametres } from '@/types/models';

export function useParametres(): Parametres | undefined {
  return useLiveQuery(() => db.parametres.get('global'));
}
