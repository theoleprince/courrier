import { db } from '@/db/db';
import { uid, sha256 } from '@/services/crypto';
import { maintenantISO, ajouterJours } from '@/services/horloge';
import { tracer } from '@/services/journal';
import { ErreurWorkflow } from '@/services/erreurs';
import { creerNotification } from '@/services/notifications';
import type { Acteur, Courrier, ID, NatureTache, PieceJointe, Sens, TacheConfiee } from '@/types/models';

/*
 * Tâches confiées (note + imputation interne).
 *
 * Le titulaire de l'étape en cours (ex. le DG au parapheur) écrit une note et
 * confie le travail à un autre poste (ex. son assistante), avec une instruction
 * (préparer un projet de réponse, corriger le document, pour avis…). L'étape
 * reste la sienne : le destinataire rend compte avec ce que l'instruction
 * demande, le dossier revient au titulaire, qui valide alors son étape. Tant
 * qu'une tâche est ouverte, l'étape ne peut pas être validée, rejetée ni signée.
 */

export interface DonneesTache {
  posteDestinataireId: ID;
  note: string;
  nature?: NatureTache;
  delaiJours?: number;
}

export interface FichierTache {
  blob: Blob;
  nom: string;
  mime: string;
}

export interface DonneesCompteRendu {
  texte: string;
  fichier?: FichierTache;
  /** POUR_AVIS */
  avis?: 'FAVORABLE' | 'DEFAVORABLE';
  /** CORRIGER_DOCUMENT : la version corrigée (PDF). */
  versionCorrigee?: FichierTache;
}

/** Instructions proposées selon le sens du courrier (la première est proposée par défaut). */
export function naturesPossibles(sens: Sens): NatureTache[] {
  return sens === 'ENTRANT'
    ? ['SUITE_A_DONNER', 'PROJET_REPONSE', 'POUR_AVIS', 'POUR_INFORMATION']
    : ['SUITE_A_DONNER', 'CORRIGER_DOCUMENT', 'POUR_AVIS', 'POUR_INFORMATION'];
}

export function natureDe(tache: Pick<TacheConfiee, 'nature'>): NatureTache {
  return tache.nature ?? 'SUITE_A_DONNER';
}

async function libellePoste(posteId: ID): Promise<string> {
  return (await db.postes.get(posteId))?.libelle ?? '';
}

/** Dernier brouillon, à défaut dernier scan : le document sur lequel on travaille. */
async function documentDeTravail(courrierId: ID): Promise<{ piece: PieceJointe | undefined; versionMax: number }> {
  const pieces = await db.piecesJointes.where('courrierId').equals(courrierId).toArray();
  const tri = [...pieces].sort((a, b) => b.version - a.version);
  return {
    piece: tri.find((p) => p.nature === 'BROUILLON') ?? tri.find((p) => p.nature === 'SCAN'),
    versionMax: Math.max(0, ...pieces.map((p) => p.version)),
  };
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
  const nature = donnees.nature ?? 'SUITE_A_DONNER';
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
    const courrier = await db.courriers.get(circuit.courrierId);
    if (!courrier) throw new ErreurWorkflow('erreurs.courrierIntrouvable');
    if (!naturesPossibles(courrier.sens).includes(nature)) throw new ErreurWorkflow('erreurs.natureTacheImpossible');
    if (nature === 'CORRIGER_DOCUMENT' && !(await documentDeTravail(courrier.id)).piece) {
      throw new ErreurWorkflow('erreurs.documentIntrouvable');
    }

    const maintenant = maintenantISO();
    const tache: TacheConfiee = {
      id: uid(),
      nature,
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
      details: { tacheId: tache.id, nature, posteDestinataireId: destinataire.id },
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

/** PROJET_REPONSE : rattache à la tâche le sortant (brouillon) que le destinataire vient de rédiger. */
export async function attacherProjetReponse(tacheId: ID, acteur: Acteur, sortantId: ID): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const tache = await db.tachesConfiees.get(tacheId);
    if (!tache || tache.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.tacheIntrouvable');
    if (tache.posteDestinataireId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');
    if (natureDe(tache) !== 'PROJET_REPONSE') throw new ErreurWorkflow('erreurs.natureTacheImpossible');
    const sortant = await db.courriers.get(sortantId);
    if (!sortant || sortant.sens !== 'SORTANT' || sortant.reponseAId !== tache.courrierId) {
      throw new ErreurWorkflow('erreurs.projetReponseInvalide');
    }
    await db.tachesConfiees.update(tacheId, { sortantProduitId: sortantId });
  });
}

export async function rendreCompte(tacheId: ID, acteur: Acteur, donnees: DonneesCompteRendu): Promise<void> {
  const [empreinteFichier, empreinteVersion] = await Promise.all([
    donnees.fichier ? sha256(donnees.fichier.blob) : undefined,
    donnees.versionCorrigee ? sha256(donnees.versionCorrigee.blob) : undefined,
  ]);

  await db.transaction('rw', db.tables, async () => {
    const tache = await db.tachesConfiees.get(tacheId);
    if (!tache || tache.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.tacheIntrouvable');
    if (tache.posteDestinataireId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');

    // Ce que chaque instruction exige, et le compte rendu par défaut quand le texte est facultatif.
    const nature = natureDe(tache);
    let texte = donnees.texte.trim();
    switch (nature) {
      case 'POUR_AVIS':
        if (!donnees.avis) throw new ErreurWorkflow('erreurs.avisObligatoire');
        if (!texte) throw new ErreurWorkflow('erreurs.compteRenduObligatoire');
        break;
      case 'CORRIGER_DOCUMENT':
        if (!donnees.versionCorrigee) throw new ErreurWorkflow('erreurs.versionCorrigeeObligatoire');
        if (donnees.versionCorrigee.mime !== 'application/pdf') throw new ErreurWorkflow('erreurs.pdfAttendu');
        texte ||= 'Version corrigée déposée.';
        break;
      case 'PROJET_REPONSE':
        if (!tache.sortantProduitId) throw new ErreurWorkflow('erreurs.projetReponseManquant');
        texte ||= 'Projet de réponse préparé.';
        break;
      case 'POUR_INFORMATION':
        texte ||= 'Vu.';
        break;
      default:
        if (!texte) throw new ErreurWorkflow('erreurs.compteRenduObligatoire');
    }

    const maintenant = maintenantISO();
    const travail = await documentDeTravail(tache.courrierId);
    const source = travail.piece;
    let versionMax = travail.versionMax;

    let pieceProduiteId: ID | undefined;
    if (donnees.versionCorrigee && empreinteVersion) {
      pieceProduiteId = uid();
      versionMax += 1;
      // Même nature que le document de travail : c'est cette version qui sera visée ou signée ensuite.
      await db.piecesJointes.add({
        id: pieceProduiteId,
        courrierId: tache.courrierId,
        nom: donnees.versionCorrigee.nom,
        mime: 'application/pdf',
        taille: donnees.versionCorrigee.blob.size,
        contenu: donnees.versionCorrigee.blob,
        version: versionMax,
        nature: source?.nature ?? 'BROUILLON',
        empreinteSha256: empreinteVersion,
        ajouteeParId: acteur.personneId,
        ajouteeLe: maintenant,
      });
    }

    let pieceJointeId: ID | undefined;
    if (donnees.fichier && empreinteFichier) {
      pieceJointeId = uid();
      await db.piecesJointes.add({
        id: pieceJointeId,
        courrierId: tache.courrierId,
        nom: donnees.fichier.nom,
        mime: donnees.fichier.mime,
        taille: donnees.fichier.blob.size,
        contenu: donnees.fichier.blob,
        version: versionMax + 1,
        nature: 'ANNEXE',
        empreinteSha256: empreinteFichier,
        ajouteeParId: acteur.personneId,
        ajouteeLe: maintenant,
      });
    }

    await db.tachesConfiees.update(tacheId, {
      statut: 'RENDUE',
      compteRendu: texte,
      avis: nature === 'POUR_AVIS' ? donnees.avis : undefined,
      pieceJointeId,
      pieceProduiteId,
      clotureeParId: acteur.personneId,
      clotureeLe: maintenant,
    });

    await tracer({
      courrierId: tache.courrierId,
      action: 'COMPTE_RENDU',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      commentaire: texte,
      details: {
        tacheId,
        nature,
        ...(donnees.avis && nature === 'POUR_AVIS' ? { avis: donnees.avis } : {}),
        ...(donnees.versionCorrigee ? { versionCorrigee: donnees.versionCorrigee.nom } : {}),
        ...(tache.sortantProduitId ? { sortantProduitId: tache.sortantProduitId } : {}),
        ...(donnees.fichier ? { fichier: donnees.fichier.nom } : {}),
      },
    });
    const prefixe = nature === 'POUR_AVIS' ? `Avis ${donnees.avis === 'FAVORABLE' ? 'favorable' : 'défavorable'}` : 'Compte rendu';
    await creerNotification({
      posteId: tache.posteSourceId,
      courrierId: tache.courrierId,
      type: 'COMPTE_RENDU',
      cle: `COMPTE_RENDU:${tacheId}`,
      message: `${prefixe} de ${await libellePoste(acteur.posteId)} : ${texte}`,
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

/** Le responsable qui a demandé ce projet de réponse peut le soumettre au circuit. */
export async function peutSoumettreProjet(sortantId: ID, posteId: ID): Promise<boolean> {
  const taches = await db.tachesConfiees.filter((t) => t.sortantProduitId === sortantId).toArray();
  return taches.some((t) => t.posteSourceId === posteId);
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
