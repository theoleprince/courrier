import { addDays } from 'date-fns';
import { db } from '@/db/db';
import type { ISODate } from '@/types/models';

/**
 * Seul point d'accès au temps du code métier (règle du cahier des charges,
 * section 3) : jamais de `new Date()` en dehors de ce fichier.
 */

let decalageMinutesCache = 0;
let charge = false;

async function chargerDecalage(): Promise<number> {
  const parametres = await db.parametres.get('global');
  decalageMinutesCache = parametres?.decalageHorlogeMinutes ?? 0;
  charge = true;
  return decalageMinutesCache;
}

/** À appeler après toute écriture de `parametres.decalageHorlogeMinutes`. */
export function invaliderCacheHorloge(): void {
  charge = false;
}

/** Horloge synchrone, basée sur le dernier décalage connu (chargé au démarrage). */
export function maintenant(): Date {
  return new Date(Date.now() + decalageMinutesCache * 60_000);
}

export function maintenantISO(): ISODate {
  return maintenant().toISOString();
}

/** Force le rechargement du décalage depuis Dexie ; à appeler au démarrage de l'app. */
export async function initHorloge(): Promise<void> {
  await chargerDecalage();
}

export async function decaler(minutes: number): Promise<void> {
  const parametres = await db.parametres.get('global');
  const nouveauDecalage = (parametres?.decalageHorlogeMinutes ?? 0) + minutes;
  await db.parametres.update('global', { decalageHorlogeMinutes: nouveauDecalage });
  decalageMinutesCache = nouveauDecalage;
  charge = true;
}

export async function revenirAuPresent(): Promise<void> {
  await db.parametres.update('global', { decalageHorlogeMinutes: 0 });
  decalageMinutesCache = 0;
  charge = true;
}

export function decalageActuelMinutes(): number {
  return decalageMinutesCache;
}

export function horlogeChargee(): boolean {
  return charge;
}

/** Arithmétique de dates sur une ISODate existante (ne consulte pas l'heure courante). */
export function ajouterJours(date: ISODate, jours: number): ISODate {
  return addDays(new Date(date), jours).toISOString();
}
