import { db } from '@/db/db';
import { uid, sha256 } from '@/services/crypto';
import { maintenantISO, ajouterJours } from '@/services/horloge';
import { tracer } from '@/services/journal';
import { ErreurWorkflow } from '@/services/erreurs';
import { creerNotification } from '@/services/notifications';
import type { Acteur, Courrier, ID, TacheConfiee } from '@/types/models';

/*
 * Tâches confiées (note + imputation interne).
 *
 * Le titulaire de l'étape en cours (ex. le DG au parapheur) écrit une note et
 * confie le travail à un autre poste (ex. son assistante). L'étape reste la
 * sienne : le destinataire rend compte, le dossier revient au titulaire, qui
 * valide alors son étape. Tant qu'une tâche est ouverte, l'étape ne peut pas
 * être validée, rejetée ni signée.
 */

export interface DonneesTache {
  posteDestinataireId: ID;
  note: string;
  delaiJours?: number;
}

export interface DonneesCompteRendu {
  texte: string;
  fichier?: { blob: Blob; nom: string; mime: string };
}

async function libellePoste(posteId: ID): Promise<string> {
  return (await db.postes.get(posteId))?.libelle ?? '';
}

/** Tâches encore ouvertes sur l'étape en cours d'un circuit. */
export async function tachesOuvertesEtape(circuitId: ID, etapeOrdre: number): Promise<TacheConfiee[]> {
  const taches = await db.tachesConfiees.where('circuitId').equals(circuitId).toArray();
  return taches.filter((t) => t.etapeOrdre === etapeOrdre && t.statut === 'EN_COURS');
}

/** Empêche de clore une étape tant qu'une tâche confiée attend son compte rendu. */
export async function verifierAucuneTacheOuverte(circuitId: ID, etapeOrdre: number): Promise<void> {
  const [ouverte] = await tachesOuvertesEtape(circuitId, etapeOrdre);
  if (ouverte) {
    throw new ErreurWorkflow('erreurs.tacheConfieeEnCours', { poste: await libellePoste(ouverte.posteDestinataireId) });
  }
}

export async function confierTache(circuitId: ID, acteur: Acteur, donnees: DonneesTache): Promise<TacheConfiee> {
  const note = donnees.note.trim();
  if (!note) throw new ErreurWorkflow('erreurs.noteObligatoire');
  if (donnees.posteDestinataireId === acteur.posteId) throw new ErreurWorkflow('erreurs.confierASoiMeme');

  return db.transaction('rw', db.tables, async () => {
    const circuit = await db.circuits.get(circuitId);
    if (!circuit || circuit.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.circuitIntrouvable');
    const etape = circuit.etapes[circuit.indexCourant];
    if (!etape || etape.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.etapeIntrouvable');
    if (etape.posteAssigneId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');
    const destinataire = await db.postes.get(donnees.posteDestinataireId);
    if (!destinataire?.actif) throw new ErreurWorkflow('erreurs.posteIntrouvable');

    const maintenant = maintenantISO();
    const tache: TacheConfiee = {
      id: uid(),
      courrierId: circuit.courrierId,
      circuitId,
      etapeOrdre: etape.ordre,
      posteSourceId: acteur.posteId,
      confieeParId: acteur.personneId,
      posteDestinataireId: destinataire.id,
      note,
      confieeLe: maintenant,
      echeance: donnees.delaiJours ? ajouterJours(maintenant, donnees.delaiJours) : undefined,
      statut: 'EN_COURS',
    };
    await db.tachesConfiees.add(tache);

    await tracer({
      courrierId: circuit.courrierId,
      action: 'TACHE_CONFIEE',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      commentaire: note,
      details: { tacheId: tache.id, posteDestinataireId: destinataire.id },
    });
    await creerNotification({
      posteId: destinataire.id,
      courrierId: circuit.courrierId,
      type: 'TACHE_CONFIEE',
      cle: `TACHE_CONFIEE:${tache.id}`,
      message: `Tâche confiée par ${await libellePoste(acteur.posteId)} : ${note}`,
    });
    return tache;
  });
}

export async function rendreCompte(tacheId: ID, acteur: Acteur, donnees: DonneesCompteRendu): Promise<void> {
  const texte = donnees.texte.trim();
  if (!texte) throw new ErreurWorkflow('erreurs.compteRenduObligatoire');
  const empreinte = donnees.fichier ? await sha256(donnees.fichier.blob) : undefined;

  await db.transaction('rw', db.tables, async () => {
    const tache = await db.tachesConfiees.get(tacheId);
    if (!tache || tache.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.tacheIntrouvable');
    if (tache.posteDestinataireId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');

    const maintenant = maintenantISO();
    let pieceJointeId: ID | undefined;
    if (donnees.fichier && empreinte) {
      const pieces = await db.piecesJointes.where('courrierId').equals(tache.courrierId).toArray();
      pieceJointeId = uid();
      await db.piecesJointes.add({
        id: pieceJointeId,
        courrierId: tache.courrierId,
        nom: donnees.fichier.nom,
        mime: donnees.fichier.mime,
        taille: donnees.fichier.blob.size,
        contenu: donnees.fichier.blob,
        version: 1 + Math.max(0, ...pieces.map((p) => p.version)),
        nature: 'ANNEXE',
        empreinteSha256: empreinte,
        ajouteeParId: acteur.personneId,
        ajouteeLe: maintenant,
      });
    }

    await db.tachesConfiees.update(tacheId, {
      statut: 'RENDUE',
      compteRendu: texte,
      pieceJointeId,
      clotureeParId: acteur.personneId,
      clotureeLe: maintenant,
    });

    await tracer({
      courrierId: tache.courrierId,
      action: 'COMPTE_RENDU',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      commentaire: texte,
      details: { tacheId, ...(donnees.fichier ? { fichier: donnees.fichier.nom } : {}) },
    });
    await creerNotification({
      posteId: tache.posteSourceId,
      courrierId: tache.courrierId,
      type: 'COMPTE_RENDU',
      cle: `COMPTE_RENDU:${tacheId}`,
      message: `Compte rendu de ${await libellePoste(acteur.posteId)} : ${texte}`,
    });
  });
}

/** Le titulaire reprend la main sans attendre le compte rendu. */
export async function annulerTache(tacheId: ID, acteur: Acteur): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const tache = await db.tachesConfiees.get(tacheId);
    if (!tache || tache.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.tacheIntrouvable');
    if (tache.posteSourceId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');

    await db.tachesConfiees.update(tacheId, { statut: 'ANNULEE', clotureeParId: acteur.personneId, clotureeLe: maintenantISO() });
    await tracer({
      courrierId: tache.courrierId,
      action: 'TACHE_ANNULEE',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      details: { tacheId },
    });
  });
}

export interface ElementTacheConfiee {
  tache: TacheConfiee;
  courrier: Courrier;
}

/** Tâches confiées à ce poste et encore ouvertes (corbeille du destinataire). */
export async function tachesConfieesA(posteId: ID): Promise<ElementTacheConfiee[]> {
  const taches = await db.tachesConfiees.where('[posteDestinataireId+statut]').equals([posteId, 'EN_COURS']).toArray();
  const resultats: ElementTacheConfiee[] = [];
  for (const tache of taches) {
    const courrier = await db.courriers.get(tache.courrierId);
    if (courrier) resultats.push({ tache, courrier });
  }
  return resultats.sort((a, b) => a.tache.confieeLe.localeCompare(b.tache.confieeLe));
}
