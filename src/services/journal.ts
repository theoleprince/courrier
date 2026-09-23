import { db } from '@/db/db';
import { maintenantISO } from '@/services/horloge';
import { sha256Sync, uid } from '@/services/crypto';
import { canonicalJSON } from '@/services/canonical';
import type { ActionHistorique, Historique, ID } from '@/types/models';

export const EMPREINTE_GENESE = '0'.repeat(64);
/** Acteur conventionnel pour les actions déclenchées par le système (horloge, escalade…). */
export const ACTEUR_SYSTEME: ID = 'systeme';

export interface ParametresTrace {
  courrierId: ID;
  action: ActionHistorique;
  acteurId: ID;
  posteId: ID;
  commentaire?: string;
  details?: Record<string, unknown>;
}

/**
 * Ajoute une entrée au journal chaîné. Doit être appelée à l'intérieur de la
 * transaction Dexie qui écrit l'événement métier correspondant, car son calcul
 * d'empreinte (js-sha256, synchrone) est la seule opération de ce module
 * autorisée dans une transaction (cf. règle Dexie, section 3 des spécifications).
 */
export async function tracer(params: ParametresTrace): Promise<Historique> {
  const sequencePrecedente = (await db.sequences.get('JOURNAL'))?.valeur ?? 0;
  const sequence = sequencePrecedente + 1;
  await db.sequences.put({ id: 'JOURNAL', valeur: sequence });

  const entreePrecedente =
    sequencePrecedente > 0
      ? await db.historique.where('sequence').equals(sequencePrecedente).first()
      : undefined;
  const empreintePrecedente = entreePrecedente?.empreinte ?? EMPREINTE_GENESE;

  const base: Omit<Historique, 'empreinte'> = {
    id: uid(),
    sequence,
    courrierId: params.courrierId,
    action: params.action,
    acteurId: params.acteurId,
    posteId: params.posteId,
    date: maintenantISO(),
    commentaire: params.commentaire,
    details: params.details,
    empreintePrecedente,
  };
  const empreinte = sha256Sync(empreintePrecedente + canonicalJSON(base));
  const entree: Historique = { ...base, empreinte };
  await db.historique.add(entree);
  return entree;
}

export interface ResultatVerificationJournal {
  valide: boolean;
  entreesVerifiees: number;
  premiereSequenceCorrompue?: number;
}

/** Recalcule la chaîne entière et compare aux empreintes stockées. */
export async function verifierJournal(): Promise<ResultatVerificationJournal> {
  const entrees = await db.historique.orderBy('sequence').toArray();
  let empreintePrecedente = EMPREINTE_GENESE;

  for (const entree of entrees) {
    const { empreinte, ...base } = entree;
    const empreinteAttendue = sha256Sync(empreintePrecedente + canonicalJSON(base));
    if (
      base.empreintePrecedente !== empreintePrecedente ||
      empreinte !== empreinteAttendue
    ) {
      return {
        valide: false,
        entreesVerifiees: entrees.length,
        premiereSequenceCorrompue: entree.sequence,
      };
    }
    empreintePrecedente = empreinte;
  }

  return { valide: true, entreesVerifiees: entrees.length };
}
