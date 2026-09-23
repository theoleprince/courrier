import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { ID } from '@/types/models';

export function useCourrier(id: ID | undefined) {
  return useLiveQuery(async () => {
    if (!id) return undefined;
    const courrier = await db.courriers.get(id);
    if (!courrier) return undefined;
    const [circuit, pieces, correspondant, signatures, historique] = await Promise.all([
      courrier.circuitInstanceId ? db.circuits.get(courrier.circuitInstanceId) : undefined,
      db.piecesJointes.where('courrierId').equals(id).toArray(),
      db.correspondants.get(courrier.correspondantId),
      db.signatures.where('courrierId').equals(id).toArray(),
      db.historique.where('courrierId').equals(id).sortBy('sequence'),
    ]);
    return { courrier, circuit, pieces, correspondant, signatures, historique };
  }, [id]);
}
