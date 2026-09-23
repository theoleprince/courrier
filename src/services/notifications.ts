import { db } from '@/db/db';
import { maintenant, maintenantISO } from '@/services/horloge';
import { uid } from '@/services/crypto';
import { tracer, ACTEUR_SYSTEME } from '@/services/journal';
import { superieurHierarchique } from '@/services/organisation';
import type { ID, TypeNotification } from '@/types/models';

export interface ParametresNotification {
  posteId: ID;
  courrierId: ID;
  type: TypeNotification;
  cle: string;
  message: string;
}

/** Crée une notification, sans effet si une notification portant la même `cle` existe déjà. */
export async function creerNotification(params: ParametresNotification): Promise<void> {
  const existe = await db.notifications.where('cle').equals(params.cle).first();
  if (existe) return;
  await db.notifications.add({
    id: uid(),
    posteId: params.posteId,
    courrierId: params.courrierId,
    type: params.type,
    cle: params.cle,
    message: params.message,
    creeLe: maintenantISO(),
  });
}

export async function marquerNotificationLue(id: ID): Promise<void> {
  await db.notifications.update(id, { lueLe: maintenantISO() });
}

export async function toutMarquerCommeLu(posteIds: ID[]): Promise<void> {
  const maintenant = maintenantISO();
  await db.transaction('rw', db.notifications, async () => {
    for (const posteId of posteIds) {
      const notifs = await db.notifications.where('posteId').equals(posteId).toArray();
      for (const n of notifs) {
        if (!n.lueLe) await db.notifications.update(n.id, { lueLe: maintenant });
      }
    }
  });
}

/**
 * Vérifie les échéances de tous les circuits en cours : rappels, retards et
 * escalades (section 11.2). À appeler au démarrage, périodiquement, et après
 * chaque saut d'horloge. Le dédoublonnage par `cle` (index unique) rend les
 * appels répétés sans effet indésirable.
 */
export async function verifierEcheances(): Promise<void> {
  const maintenantDate = maintenant();
  const [circuits, courriers, entites, postes, parametres] = await Promise.all([
    db.circuits.where('statut').equals('EN_COURS').toArray(),
    db.courriers.toArray(),
    db.entites.toArray(),
    db.postes.toArray(),
    db.parametres.get('global'),
  ]);
  const courrierParId = new Map(courriers.map((c) => [c.id, c]));
  const delaiEscaladeJours = parametres?.delaiEscaladeJours ?? 2;

  for (const circuit of circuits) {
    const etape = circuit.etapes[circuit.indexCourant];
    if (!etape || etape.statut !== 'EN_COURS' || !etape.echeance || !etape.posteAssigneId) continue;
    const courrier = courrierParId.get(circuit.courrierId);
    if (!courrier) continue;

    const echeance = new Date(etape.echeance);
    const enRetard = echeance.getTime() < maintenantDate.getTime();
    const dansMoins24h = !enRetard && echeance.getTime() - maintenantDate.getTime() < 24 * 60 * 60 * 1000;

    if (dansMoins24h) {
      await creerNotification({
        posteId: etape.posteAssigneId,
        courrierId: courrier.id,
        type: 'RAPPEL_ECHEANCE',
        cle: `RAPPEL:${circuit.id}:${circuit.indexCourant}`,
        message: `Échéance proche pour ${courrier.numero ?? courrier.codeSuivi} : ${etape.libelle}`,
      });
    } else if (enRetard) {
      await creerNotification({
        posteId: etape.posteAssigneId,
        courrierId: courrier.id,
        type: 'RETARD',
        cle: `RETARD:${circuit.id}:${circuit.indexCourant}`,
        message: `Retard sur ${courrier.numero ?? courrier.codeSuivi} : ${etape.libelle}`,
      });

      const joursRetard = (maintenantDate.getTime() - echeance.getTime()) / (24 * 60 * 60 * 1000);
      if (joursRetard >= delaiEscaladeJours && !etape.escaladeeLe) {
        const posteAssigne = postes.find((p) => p.id === etape.posteAssigneId);
        const superieur = posteAssigne ? superieurHierarchique(posteAssigne, entites, postes) : undefined;
        if (superieur) {
          await creerNotification({
            posteId: superieur.id,
            courrierId: courrier.id,
            type: 'ESCALADE',
            cle: `ESCALADE:${circuit.id}:${circuit.indexCourant}`,
            message: `Escalade : ${courrier.numero ?? courrier.codeSuivi} en retard chez ${posteAssigne?.libelle}`,
          });
          etape.escaladeeLe = maintenantISO();
          await db.circuits.put(circuit);
          await tracer({
            courrierId: courrier.id,
            action: 'ESCALADE',
            acteurId: ACTEUR_SYSTEME,
            posteId: ACTEUR_SYSTEME,
            details: { etape: etape.libelle, posteAssigneId: etape.posteAssigneId, superieurId: superieur.id },
          });
        }
      }
    }
  }

  // Entrants en attente de réponse dont la date limite est dépassée.
  for (const courrier of courriers) {
    if (courrier.sens !== 'ENTRANT' || courrier.statut !== 'EN_ATTENTE_REPONSE') continue;
    if (!courrier.dateLimiteReponse) continue;
    if (new Date(courrier.dateLimiteReponse).getTime() >= maintenantDate.getTime()) continue;
    if (!courrier.entiteTraitanteId) continue;
    const responsable = postes.find((p) => p.entiteId === courrier.entiteTraitanteId && p.estResponsable && p.actif);
    if (!responsable) continue;
    await creerNotification({
      posteId: responsable.id,
      courrierId: courrier.id,
      type: 'RETARD',
      cle: `RETARD_REPONSE:${courrier.id}`,
      message: `Réponse attendue en retard : ${courrier.numero ?? courrier.codeSuivi}`,
    });
  }
}
