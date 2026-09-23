import { db } from '@/db/db';
import { uid, sha256, genererCodeSuivi } from '@/services/crypto';
import { maintenant, maintenantISO, ajouterJours } from '@/services/horloge';
import { tracer, ACTEUR_SYSTEME } from '@/services/journal';
import { ErreurWorkflow } from '@/services/erreurs';
import { direction } from '@/services/organisation';
import { creerNotification } from '@/services/notifications';
import { sortantReponseDe } from '@/services/requetes';
import { apposerSignature, apposerVisa } from '@/services/signature';
import type {
  Acteur,
  CircuitInstance,
  Confidentialite,
  Courrier,
  CourrierEntrant,
  CourrierSortant,
  Deposant,
  Diffusion,
  EtapeInstance,
  EtapeModele,
  ID,
  ISODate,
  ModeDepot,
  ModeEnvoi,
  ModeleCircuit,
  PieceJointe,
  Priorite,
  Sens,
  Signature,
  StatutEntrant,
  StatutSortant,
  TypeCourrier,
} from '@/types/models';

/* ------------------------------------------------------------------ */
/* Numérotation                                                        */
/* ------------------------------------------------------------------ */

/** ARR-AAAA-NNNNNN / DEP-AAAA-NNNNNN, séquence par sens et par année. Doit être appelé dans la transaction de création. */
export async function prochainNumero(sens: Sens): Promise<string> {
  const annee = maintenant().getFullYear();
  const prefixe = sens === 'ENTRANT' ? 'ARR' : 'DEP';
  const cleSequence = `${sens}-${annee}`;
  const valeur = ((await db.sequences.get(cleSequence))?.valeur ?? 0) + 1;
  await db.sequences.put({ id: cleSequence, valeur });
  return `${prefixe}-${annee}-${String(valeur).padStart(6, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Résolution des cibles d'étape et moteur de circuit                  */
/* ------------------------------------------------------------------ */

async function resoudrePosteCible(etape: Pick<EtapeModele, 'posteCibleId' | 'roleCible'>, courrier: Courrier): Promise<ID> {
  if (etape.posteCibleId) return etape.posteCibleId;
  if (!etape.roleCible) throw new ErreurWorkflow('erreurs.etapeSansCible');

  switch (etape.roleCible) {
    case 'BUREAU_ORDRE': {
      const postesBO = (await db.postes.where('role').equals('BUREAU_ORDRE').toArray()).filter((p) => p.actif);
      const poste = postesBO.find((p) => !p.estResponsable) ?? postesBO.find((p) => p.estResponsable);
      if (!poste) throw new ErreurWorkflow('erreurs.posteIntrouvable', { role: 'BUREAU_ORDRE' });
      return poste.id;
    }
    case 'REDACTEUR': {
      const createur = await db.personnes.get(courrier.creeParId);
      if (!createur?.posteId) throw new ErreurWorkflow('erreurs.redacteurIntrouvable');
      return createur.posteId;
    }
    case 'RESPONSABLE_ENTITE_TRAITANTE': {
      if (!courrier.entiteTraitanteId) throw new ErreurWorkflow('erreurs.imputationManquante');
      const postes = (await db.postes.where('entiteId').equals(courrier.entiteTraitanteId).toArray());
      const responsable = postes.find((p) => p.estResponsable && p.actif);
      if (!responsable) throw new ErreurWorkflow('erreurs.responsableIntrouvable');
      return responsable.id;
    }
    case 'DIRECTEUR_ENTITE_TRAITANTE': {
      if (!courrier.entiteTraitanteId) throw new ErreurWorkflow('erreurs.imputationManquante');
      const entites = await db.entites.toArray();
      const dir = direction(courrier.entiteTraitanteId, entites);
      if (!dir) throw new ErreurWorkflow('erreurs.directionIntrouvable');
      const postes = await db.postes.where('entiteId').equals(dir.id).toArray();
      const responsable = postes.find((p) => p.estResponsable && p.actif);
      if (!responsable) throw new ErreurWorkflow('erreurs.responsableIntrouvable');
      return responsable.id;
    }
  }
}

function statutEntrantDepuisEtape(actuel: StatutEntrant, type: EtapeInstance['type']): StatutEntrant {
  switch (type) {
    case 'IMPUTATION':
      return 'ENREGISTRE';
    case 'TRAITEMENT':
      return 'EN_TRAITEMENT';
    case 'VISA':
    case 'VALIDATION':
    case 'SIGNATURE':
      return 'EN_VALIDATION';
    default:
      return actuel;
  }
}

function statutSortantDepuisEtape(actuel: StatutSortant, type: EtapeInstance['type']): StatutSortant {
  switch (type) {
    case 'VISA':
    case 'VALIDATION':
    case 'SIGNATURE':
      return 'EN_VALIDATION';
    case 'EXPEDITION':
      return 'SIGNE';
    default:
      return actuel;
  }
}

function appliquerStatutDepuisEtape(courrier: Courrier, type: EtapeInstance['type']): void {
  if (courrier.sens === 'ENTRANT') {
    courrier.statut = statutEntrantDepuisEtape(courrier.statut, type);
  } else {
    courrier.statut = statutSortantDepuisEtape(courrier.statut, type);
  }
}

/**
 * Active l'étape à `index`, en sautant automatiquement les étapes VISA /
 * VALIDATION dont `sauterSiRedacteur` est vrai et dont le poste résolu est
 * celui du rédacteur ou de l'étape précédente (règle 8.2.5). Termine le
 * circuit si toutes les étapes sont épuisées.
 */
async function activerAPartirDe(circuit: CircuitInstance, courrier: Courrier, indexDepart: number): Promise<void> {
  let index = indexDepart;

  while (index < circuit.etapes.length) {
    const etape = circuit.etapes[index];
    const posteAssigneId = await resoudrePosteCible(etape, courrier);

    if (etape.sauterSiRedacteur && (etape.type === 'VISA' || etape.type === 'VALIDATION')) {
      const posteRedacteur =
        courrier.sens === 'SORTANT' ? (await db.personnes.get(courrier.creeParId))?.posteId : undefined;
      const postePrecedent = index > 0 ? circuit.etapes[index - 1].posteAssigneId : undefined;
      if (posteAssigneId === posteRedacteur || (!!postePrecedent && posteAssigneId === postePrecedent)) {
        etape.statut = 'IGNOREE';
        etape.posteAssigneId = posteAssigneId;
        etape.debutLe = maintenantISO();
        etape.finLe = etape.debutLe;
        await tracer({
          courrierId: courrier.id,
          action: 'ETAPE_IGNOREE',
          acteurId: ACTEUR_SYSTEME,
          posteId: ACTEUR_SYSTEME,
          commentaire: etape.libelle,
        });
        index += 1;
        continue;
      }
    }

    etape.statut = 'EN_COURS';
    etape.posteAssigneId = posteAssigneId;
    etape.debutLe = maintenantISO();
    etape.echeance = ajouterJours(etape.debutLe, etape.delaiJours);
    circuit.indexCourant = index;
    circuit.posteCourantId = posteAssigneId;
    await db.circuits.put(circuit);

    appliquerStatutDepuisEtape(courrier, etape.type);
    courrier.misAJourLe = maintenantISO();
    await db.courriers.put(courrier);

    await creerNotification({
      posteId: posteAssigneId,
      courrierId: courrier.id,
      type: 'NOUVELLE_TACHE',
      cle: `TACHE:${circuit.id}:${index}`,
      message: `${etape.libelle} — ${courrier.numero ?? courrier.codeSuivi}`,
    });
    return;
  }

  await terminerCircuit(circuit, courrier);
}

async function terminerCircuit(circuit: CircuitInstance, courrier: Courrier): Promise<void> {
  circuit.statut = 'TERMINE';
  circuit.termineLe = maintenantISO();
  circuit.posteCourantId = null;
  await db.circuits.put(circuit);
  await tracer({ courrierId: courrier.id, action: 'CIRCUIT_TERMINE', acteurId: ACTEUR_SYSTEME, posteId: ACTEUR_SYSTEME });

  if (courrier.sens === 'ENTRANT') {
    const sortant = await sortantReponseDe(courrier.id);
    const cloture = !courrier.reponseAttendue || sortant?.statut === 'EXPEDIE';
    courrier.statut = cloture ? 'CLOTURE' : 'EN_ATTENTE_REPONSE';
    courrier.misAJourLe = maintenantISO();
    await db.courriers.put(courrier);
    if (cloture) {
      await tracer({ courrierId: courrier.id, action: 'CLOTURE', acteurId: ACTEUR_SYSTEME, posteId: ACTEUR_SYSTEME });
    }
  }
}

async function choisirModele(sens: Sens, type: TypeCourrier, modeleIdForce?: ID): Promise<ModeleCircuit> {
  if (modeleIdForce) {
    const force = await db.modelesCircuit.get(modeleIdForce);
    if (!force || !force.actif) throw new ErreurWorkflow('erreurs.modeleIntrouvable');
    return force;
  }
  const modeles = (await db.modelesCircuit.where('sens').equals(sens).toArray()).filter((m) => m.actif);
  const specifique = modeles.find((m) => m.typesCourrier.includes(type));
  if (specifique) return specifique;
  const parDefaut = modeles.find((m) => m.typesCourrier.length === 0);
  if (parDefaut) return parDefaut;
  throw new ErreurWorkflow('erreurs.aucunModeleCircuit');
}

async function demarrerCircuit(courrier: Courrier, modeleIdForce?: ID): Promise<CircuitInstance> {
  const modele = await choisirModele(courrier.sens, courrier.type, modeleIdForce);
  const etapes: EtapeInstance[] = [...modele.etapes]
    .sort((a, b) => a.ordre - b.ordre)
    .map((e) => ({ ...e, statut: 'EN_ATTENTE' as const }));

  const circuit: CircuitInstance = {
    id: uid(),
    courrierId: courrier.id,
    modeleId: modele.id,
    etapes,
    indexCourant: -1,
    posteCourantId: null,
    statut: 'EN_COURS',
    demarreLe: maintenantISO(),
  };
  await db.circuits.add(circuit);
  courrier.circuitInstanceId = circuit.id;
  await db.courriers.put(courrier);
  await tracer({
    courrierId: courrier.id,
    action: 'CIRCUIT_DEMARRE',
    acteurId: ACTEUR_SYSTEME,
    posteId: ACTEUR_SYSTEME,
    commentaire: modele.libelle,
  });

  await activerAPartirDe(circuit, courrier, 0);
  return circuit;
}

/* ------------------------------------------------------------------ */
/* Enregistrement d'un entrant                                         */
/* ------------------------------------------------------------------ */

export interface FichierEntree {
  blob: Blob;
  nom: string;
  mime: string;
}

export interface DonneesEntrant {
  objet: string;
  type: TypeCourrier;
  priorite: Priorite;
  confidentialite: Confidentialite;
  correspondantId: ID;
  modeDepot: ModeDepot;
  deposant?: Deposant;
  dateCourrier?: ISODate;
  referenceExpediteur?: string;
  reponseAttendue: boolean;
  dateLimiteReponse?: ISODate;
  motsCles?: string[];
  cote?: string;
}

export async function enregistrerEntrant(
  data: DonneesEntrant,
  fichier: FichierEntree | undefined,
  acteur: Acteur,
  modeleId?: ID,
): Promise<CourrierEntrant> {
  const empreinteSha256 = fichier ? await sha256(fichier.blob) : undefined;

  return db.transaction('rw', db.tables, async () => {
    const numero = await prochainNumero('ENTRANT');
    const codeSuivi = genererCodeSuivi();
    const maintenantHorodatage = maintenantISO();

    const courrier: CourrierEntrant = {
      id: uid(),
      sens: 'ENTRANT',
      numero,
      codeSuivi,
      objet: data.objet,
      type: data.type,
      priorite: data.priorite,
      confidentialite: data.confidentialite,
      correspondantId: data.correspondantId,
      entiteTraitanteId: null,
      circuitInstanceId: null,
      motsCles: data.motsCles ?? [],
      cote: data.cote,
      creeParId: acteur.personneId,
      creeLe: maintenantHorodatage,
      misAJourLe: maintenantHorodatage,
      statut: 'ENREGISTRE',
      dateReception: maintenantHorodatage,
      dateCourrier: data.dateCourrier,
      referenceExpediteur: data.referenceExpediteur,
      modeDepot: data.modeDepot,
      deposant: data.deposant,
      reponseAttendue: data.reponseAttendue,
      dateLimiteReponse: data.dateLimiteReponse,
    };
    await db.courriers.add(courrier);

    if (fichier && empreinteSha256) {
      const piece: PieceJointe = {
        id: uid(),
        courrierId: courrier.id,
        nom: fichier.nom,
        mime: fichier.mime,
        taille: fichier.blob.size,
        contenu: fichier.blob,
        version: 1,
        nature: 'SCAN',
        empreinteSha256,
        ajouteeParId: acteur.personneId,
        ajouteeLe: maintenantHorodatage,
      };
      await db.piecesJointes.add(piece);
    }

    await tracer({
      courrierId: courrier.id,
      action: 'ENREGISTREMENT',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      details: { numero, codeSuivi },
    });

    await demarrerCircuit(courrier, modeleId);
    return courrier;
  });
}

/* ------------------------------------------------------------------ */
/* Sortant : création, soumission, resoumission                        */
/* ------------------------------------------------------------------ */

export interface DonneesSortant {
  objet: string;
  type: TypeCourrier;
  priorite: Priorite;
  confidentialite: Confidentialite;
  correspondantId: ID;
  reponseAId?: ID | null;
  modeleLettreId?: ID;
  motsCles?: string[];
}

export async function creerSortant(
  data: DonneesSortant,
  document: FichierEntree,
  acteur: Acteur,
  soumettre = true,
): Promise<CourrierSortant> {
  const empreinteSha256 = await sha256(document.blob);

  return db.transaction('rw', db.tables, async () => {
    const posteCreateur = await db.postes.get(acteur.posteId);
    const maintenantHorodatage = maintenantISO();

    const courrier: CourrierSortant = {
      id: uid(),
      sens: 'SORTANT',
      numero: null,
      codeSuivi: genererCodeSuivi(),
      objet: data.objet,
      type: data.type,
      priorite: data.priorite,
      confidentialite: data.confidentialite,
      correspondantId: data.correspondantId,
      entiteTraitanteId: posteCreateur?.entiteId ?? null,
      circuitInstanceId: null,
      motsCles: data.motsCles ?? [],
      creeParId: acteur.personneId,
      creeLe: maintenantHorodatage,
      misAJourLe: maintenantHorodatage,
      statut: 'BROUILLON',
      reponseAId: data.reponseAId ?? null,
      modeleLettreId: data.modeleLettreId,
    };
    await db.courriers.add(courrier);

    const piece: PieceJointe = {
      id: uid(),
      courrierId: courrier.id,
      nom: document.nom,
      mime: document.mime,
      taille: document.blob.size,
      contenu: document.blob,
      version: 1,
      nature: 'BROUILLON',
      empreinteSha256,
      ajouteeParId: acteur.personneId,
      ajouteeLe: maintenantHorodatage,
    };
    await db.piecesJointes.add(piece);

    await tracer({ courrierId: courrier.id, action: 'CREATION', acteurId: acteur.personneId, posteId: acteur.posteId });

    if (soumettre) {
      await demarrerCircuit(courrier);
    }
    return courrier;
  });
}

export async function soumettreSortant(
  courrierId: ID,
  acteur: Acteur,
  nouveauDocument?: FichierEntree,
): Promise<void> {
  const empreinteSha256 = nouveauDocument ? await sha256(nouveauDocument.blob) : undefined;

  await db.transaction('rw', db.tables, async () => {
    const courrier = await db.courriers.get(courrierId);
    if (!courrier || courrier.sens !== 'SORTANT') throw new ErreurWorkflow('erreurs.courrierIntrouvable');
    const sortant = courrier as CourrierSortant;
    if (sortant.statut !== 'BROUILLON' && sortant.statut !== 'REJETE') {
      throw new ErreurWorkflow('erreurs.soumissionImpossible');
    }

    if (nouveauDocument && empreinteSha256) {
      const pieces = await db.piecesJointes.where('[courrierId+nature]').equals([courrierId, 'BROUILLON']).toArray();
      const version = 1 + Math.max(0, ...pieces.map((p) => p.version));
      await db.piecesJointes.add({
        id: uid(),
        courrierId,
        nom: nouveauDocument.nom,
        mime: nouveauDocument.mime,
        taille: nouveauDocument.blob.size,
        contenu: nouveauDocument.blob,
        version,
        nature: 'BROUILLON',
        empreinteSha256,
        ajouteeParId: acteur.personneId,
        ajouteeLe: maintenantISO(),
      });
      await tracer({
        courrierId,
        action: 'RESOUMISSION',
        acteurId: acteur.personneId,
        posteId: acteur.posteId,
        details: { version },
      });
    }

    sortant.statut = 'EN_VALIDATION';
    await demarrerCircuit(sortant);
  });
}

/* ------------------------------------------------------------------ */
/* Traitement des étapes                                               */
/* ------------------------------------------------------------------ */

async function diffuserInterne(courrierId: ID, posteId: ID, acteur: Acteur): Promise<void> {
  const diffusion: Diffusion = {
    id: uid(),
    courrierId,
    posteId,
    diffuseeParId: acteur.personneId,
    diffuseeLe: maintenantISO(),
  };
  await db.diffusions.add(diffusion);
  await tracer({
    courrierId,
    action: 'DIFFUSION',
    acteurId: acteur.personneId,
    posteId: acteur.posteId,
    details: { posteDestinataireId: posteId },
  });
  await creerNotification({
    posteId,
    courrierId,
    type: 'DIFFUSION',
    cle: `DIFFUSION:${diffusion.id}`,
    message: 'Nouveau courrier pour information',
  });
}

export async function diffuser(courrierId: ID, posteId: ID, acteur: Acteur): Promise<void> {
  await db.transaction('rw', db.tables, () => diffuserInterne(courrierId, posteId, acteur));
}

export interface OptionsValidation {
  commentaire?: string;
  entiteTraitanteId?: ID;
  diffuserA?: ID[];
}

export async function validerEtape(circuitId: ID, acteur: Acteur, options: OptionsValidation = {}): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const circuit = await db.circuits.get(circuitId);
    if (!circuit || circuit.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.circuitIntrouvable');
    const etape = circuit.etapes[circuit.indexCourant];
    if (!etape || etape.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.etapeIntrouvable');
    if (etape.posteAssigneId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');
    if (etape.type === 'SIGNATURE' || etape.type === 'EXPEDITION') {
      throw new ErreurWorkflow('erreurs.actionIncorrecte');
    }

    const courrier = await db.courriers.get(circuit.courrierId);
    if (!courrier) throw new ErreurWorkflow('erreurs.courrierIntrouvable');

    if (etape.type === 'IMPUTATION') {
      if (!options.entiteTraitanteId) throw new ErreurWorkflow('erreurs.imputationManquante');
      courrier.entiteTraitanteId = options.entiteTraitanteId;
    }

    etape.statut = 'VALIDEE';
    etape.finLe = maintenantISO();
    etape.traiteeParId = acteur.personneId;
    etape.commentaire = options.commentaire;
    await db.circuits.put(circuit);
    await db.courriers.put(courrier);

    await tracer({
      courrierId: courrier.id,
      action: etape.type,
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      commentaire: options.commentaire,
    });

    if (options.diffuserA?.length) {
      for (const posteId of options.diffuserA) {
        await diffuserInterne(courrier.id, posteId, acteur);
      }
    }

    await activerAPartirDe(circuit, courrier, circuit.indexCourant + 1);
  });
}

/**
 * Visa ou validation du directeur : appose le paraphe et la mention « Lu et approuvé »
 * (« Validé » pour une validation) sur chaque page
 * du document de travail PDF (dernier brouillon, à défaut dernier scan),
 * en nouvelle version, puis valide l'étape. Le
 * brouillon visé est celui qui sera ensuite signé, les visas restent donc
 * visibles sur la version signée.
 */
export async function viser(
  circuitId: ID,
  acteur: Acteur,
  options: OptionsValidation & { paraphePngDataUrl: string },
): Promise<void> {
  const circuit = await db.circuits.get(circuitId);
  if (!circuit || circuit.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.circuitIntrouvable');
  const etape = circuit.etapes[circuit.indexCourant];
  if (!etape || (etape.type !== 'VISA' && etape.type !== 'VALIDATION') || etape.statut !== 'EN_COURS') {
    throw new ErreurWorkflow('erreurs.etapeIntrouvable');
  }
  if (etape.posteAssigneId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');

  const piece = await documentDeTravail(circuit.courrierId);
  const toutes = await db.piecesJointes.where('courrierId').equals(circuit.courrierId).toArray();

  let pieceVisee: PieceJointe | undefined;
  if (piece && piece.mime === 'application/pdf') {
    if ((await sha256(piece.contenu)) !== piece.empreinteSha256) throw new ErreurWorkflow('erreurs.documentAltere');
    const [poste, personne] = await Promise.all([db.postes.get(acteur.posteId), db.personnes.get(acteur.personneId)]);
    const rang = circuit.etapes
      .slice(0, circuit.indexCourant)
      .filter((e) => (e.type === 'VISA' || e.type === 'VALIDATION') && e.statut === 'VALIDEE').length;
    const contenu = await apposerVisa(piece.contenu, {
      nomViseur: personne ? `${personne.prenom} ${personne.nom}` : '',
      posteViseur: poste?.libelle ?? '',
      dateAffichee: maintenant().toLocaleString('fr-FR'),
      paraphePngDataUrl: options.paraphePngDataUrl,
      rang,
      mention: etape.type === 'VALIDATION' ? 'VALIDÉ' : undefined,
    });
    pieceVisee = {
      ...piece,
      id: uid(),
      contenu,
      taille: contenu.size,
      version: 1 + Math.max(0, ...toutes.map((p) => p.version)),
      empreinteSha256: await sha256(contenu),
      ajouteeParId: acteur.personneId,
      ajouteeLe: maintenantISO(),
    };
  }

  await db.transaction('rw', db.tables, async () => {
    if (pieceVisee) await db.piecesJointes.add(pieceVisee);
    await validerEtape(circuitId, acteur, options);
  });
}

export async function rejeterEtape(circuitId: ID, acteur: Acteur, motif: string): Promise<void> {
  if (!motif.trim()) throw new ErreurWorkflow('erreurs.motifObligatoire');

  await db.transaction('rw', db.tables, async () => {
    const circuit = await db.circuits.get(circuitId);
    if (!circuit || circuit.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.circuitIntrouvable');
    const etape = circuit.etapes[circuit.indexCourant];
    if (!etape || etape.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.etapeIntrouvable');
    if (etape.posteAssigneId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');
    if (etape.type === 'IMPUTATION' || etape.type === 'TRAITEMENT') {
      throw new ErreurWorkflow('erreurs.rejetImpossible');
    }

    const courrier = await db.courriers.get(circuit.courrierId);
    if (!courrier) throw new ErreurWorkflow('erreurs.courrierIntrouvable');

    etape.statut = 'REJETEE';
    etape.finLe = maintenantISO();
    etape.traiteeParId = acteur.personneId;
    etape.commentaire = motif;

    await tracer({
      courrierId: courrier.id,
      action: 'REJET',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      commentaire: motif,
    });

    if (courrier.sens === 'ENTRANT') {
      const indexTraitement = circuit.etapes.findIndex((e) => e.type === 'TRAITEMENT');
      for (let i = indexTraitement; i < circuit.etapes.length; i++) {
        const e = circuit.etapes[i];
        e.statut = 'EN_ATTENTE';
        e.posteAssigneId = undefined;
        e.debutLe = undefined;
        e.finLe = undefined;
        e.echeance = undefined;
        e.traiteeParId = undefined;
        e.escaladeeLe = undefined;
        if (i !== circuit.indexCourant) e.commentaire = undefined;
      }
      await db.circuits.put(circuit);
      await activerAPartirDe(circuit, courrier, indexTraitement);
    } else {
      circuit.statut = 'REJETE';
      circuit.termineLe = maintenantISO();
      circuit.posteCourantId = null;
      await db.circuits.put(circuit);

      const sortant = courrier as CourrierSortant;
      sortant.statut = 'REJETE';
      sortant.misAJourLe = maintenantISO();
      await db.courriers.put(sortant);

      const redacteur = await db.personnes.get(sortant.creeParId);
      if (redacteur?.posteId) {
        await creerNotification({
          posteId: redacteur.posteId,
          courrierId: sortant.id,
          type: 'REJET',
          cle: `REJET:${circuit.id}:${circuit.indexCourant}`,
          message: `Courrier rejeté : ${motif}`,
        });
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* Signature                                                            */
/* ------------------------------------------------------------------ */

export interface ContexteSignature {
  imagePngDataUrl: string;
  origineUrl: string; // ex. window.location.origin
  /** Apposer le cachet de l'organisation (paramètres) à côté de la signature. */
  avecCachet?: boolean;
}

async function preparerSignature(
  circuitId: ID,
  acteur: Acteur,
  contexte: ContexteSignature,
): Promise<{
  circuit: CircuitInstance;
  courrier: CourrierSortant;
  piece: PieceJointe;
  resultat: Awaited<ReturnType<typeof apposerSignature>>;
  signatureId: ID;
}> {
  const circuit = await db.circuits.get(circuitId);
  if (!circuit || circuit.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.circuitIntrouvable');
  const etape = circuit.etapes[circuit.indexCourant];
  if (!etape || etape.type !== 'SIGNATURE' || etape.statut !== 'EN_COURS') {
    throw new ErreurWorkflow('erreurs.etapeIntrouvable');
  }
  if (etape.posteAssigneId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');

  const [poste, personne, courrier] = await Promise.all([
    db.postes.get(acteur.posteId),
    db.personnes.get(acteur.personneId),
    db.courriers.get(circuit.courrierId),
  ]);
  if (!poste?.peutSigner) throw new ErreurWorkflow('erreurs.habilitationSignatureRequise');
  if (!courrier || courrier.sens !== 'SORTANT') throw new ErreurWorkflow('erreurs.courrierIntrouvable');

  const pieces = await db.piecesJointes.where('[courrierId+nature]').equals([courrier.id, 'BROUILLON']).toArray();
  const piece = pieces.sort((a, b) => b.version - a.version)[0];
  if (!piece) throw new ErreurWorkflow('erreurs.documentIntrouvable');

  const empreinteActuelle = await sha256(piece.contenu);
  if (empreinteActuelle !== piece.empreinteSha256) throw new ErreurWorkflow('erreurs.documentAltere');

  const signatureId = uid();
  const cachetPngDataUrl = contexte.avecCachet ? (await db.parametres.get('global'))?.cachetPng : undefined;
  const resultat = await apposerSignature(piece.contenu, {
    signatureId,
    nomSignataire: personne ? `${personne.prenom} ${personne.nom}` : '',
    posteSignataire: poste.libelle,
    dateAffichee: maintenant().toLocaleString('fr-FR'),
    empreinteAbregee: piece.empreinteSha256.slice(0, 24),
    imagePngDataUrl: contexte.imagePngDataUrl,
    urlVerification: `${contexte.origineUrl}/verifier/${signatureId}`,
    cachetPngDataUrl,
  });

  return { circuit, courrier: courrier as CourrierSortant, piece, resultat, signatureId };
}

export async function signer(circuitId: ID, acteur: Acteur, contexte: ContexteSignature): Promise<void> {
  const { piece, resultat, signatureId } = await preparerSignature(circuitId, acteur, contexte);

  await db.transaction('rw', db.tables, async () => {
    const circuit = await db.circuits.get(circuitId);
    if (!circuit || circuit.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.circuitIntrouvable');
    const etape = circuit.etapes[circuit.indexCourant];
    if (!etape || etape.type !== 'SIGNATURE' || etape.statut !== 'EN_COURS') {
      throw new ErreurWorkflow('erreurs.etapeIntrouvable');
    }
    const courrier = await db.courriers.get(circuit.courrierId);
    if (!courrier) throw new ErreurWorkflow('erreurs.courrierIntrouvable');

    const maintenantHorodatage = maintenantISO();
    const pieceSignee: PieceJointe = {
      id: uid(),
      courrierId: courrier.id,
      nom: piece.nom.replace(/\.pdf$/i, '') + '-signe.pdf',
      mime: 'application/pdf',
      taille: resultat.pdfSigne.size,
      contenu: resultat.pdfSigne,
      version: piece.version,
      nature: 'VERSION_SIGNEE',
      empreinteSha256: resultat.empreintePdfSigne,
      ajouteeParId: acteur.personneId,
      ajouteeLe: maintenantHorodatage,
    };
    await db.piecesJointes.add(pieceSignee);

    const signature: Signature = {
      id: signatureId,
      courrierId: courrier.id,
      pieceJointeId: piece.id,
      pieceJointeSigneeId: pieceSignee.id,
      signataireId: acteur.personneId,
      posteId: acteur.posteId,
      date: maintenantHorodatage,
      imagePng: contexte.imagePngDataUrl,
      empreinteDocument: piece.empreinteSha256,
      empreinteSignature: resultat.empreinteSignature,
      empreintePdfSigne: resultat.empreintePdfSigne,
    };
    await db.signatures.add(signature);

    etape.statut = 'VALIDEE';
    etape.finLe = maintenantHorodatage;
    etape.traiteeParId = acteur.personneId;
    await db.circuits.put(circuit);

    await tracer({
      courrierId: courrier.id,
      action: 'SIGNATURE',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      details: { signatureId, avecCachet: !!contexte.avecCachet },
    });

    const personne = await db.personnes.get(acteur.personneId);
    if (personne) await db.personnes.update(personne.id, { derniereSignaturePng: contexte.imagePngDataUrl });

    await activerAPartirDe(circuit, courrier, circuit.indexCourant + 1);
  });
}

/** Document sur lequel on travaille : dernier brouillon, à défaut dernier scan. */
export async function documentDeTravail(courrierId: ID): Promise<PieceJointe | undefined> {
  const pieces = await db.piecesJointes.where('courrierId').equals(courrierId).toArray();
  const tri = pieces.sort((a, b) => b.version - a.version);
  return tri.find((p) => p.nature === 'BROUILLON') ?? tri.find((p) => p.nature === 'SCAN');
}

/**
 * Visa / validation manuscrits : le titulaire a imprimé le document de
 * travail, l'a visé ou annoté à la main et téléverse le scan. Le scan devient
 * la version suivante du document (même nature), puis l'étape est validée.
 */
export async function validerManuscrit(circuitId: ID, acteur: Acteur, scan: FichierEntree, commentaire?: string): Promise<void> {
  if (scan.mime !== 'application/pdf') throw new ErreurWorkflow('erreurs.pdfAttendu');
  const empreinteSha256 = await sha256(scan.blob);

  await db.transaction('rw', db.tables, async () => {
    const circuit = await db.circuits.get(circuitId);
    if (!circuit || circuit.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.circuitIntrouvable');
    const etape = circuit.etapes[circuit.indexCourant];
    if (!etape || (etape.type !== 'VISA' && etape.type !== 'VALIDATION') || etape.statut !== 'EN_COURS') {
      throw new ErreurWorkflow('erreurs.etapeIntrouvable');
    }
    if (etape.posteAssigneId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');

    const source = await documentDeTravail(circuit.courrierId);
    if (!source) throw new ErreurWorkflow('erreurs.documentIntrouvable');
    const pieces = await db.piecesJointes.where('courrierId').equals(circuit.courrierId).toArray();
    await db.piecesJointes.add({
      id: uid(),
      courrierId: circuit.courrierId,
      nom: source.nom.replace(/\.pdf$/i, '') + (etape.type === 'VISA' ? '-vise-manuscrit.pdf' : '-valide-manuscrit.pdf'),
      mime: 'application/pdf',
      taille: scan.blob.size,
      contenu: scan.blob,
      version: 1 + Math.max(0, ...pieces.map((p) => p.version)),
      nature: source.nature,
      empreinteSha256,
      ajouteeParId: acteur.personneId,
      ajouteeLe: maintenantISO(),
    });

    const mention = etape.type === 'VISA' ? 'Visa manuscrit' : 'Validation manuscrite';
    const texte = `${mention} (document imprimé puis scanné : ${scan.nom})`;
    await validerEtape(circuitId, acteur, { commentaire: commentaire ? `${texte} — ${commentaire}` : texte });
  });
}

/**
 * Signature manuscrite : le signataire a imprimé le dernier brouillon (visas
 * compris), l'a signé à la main et téléverse le scan. Le scan devient la
 * version signée et l'étape SIGNATURE est validée.
 */
export async function signerManuscrit(circuitId: ID, acteur: Acteur, scan: FichierEntree): Promise<void> {
  if (scan.mime !== 'application/pdf') throw new ErreurWorkflow('erreurs.pdfAttendu');
  const empreinteScan = await sha256(scan.blob);

  await db.transaction('rw', db.tables, async () => {
    const circuit = await db.circuits.get(circuitId);
    if (!circuit || circuit.statut !== 'EN_COURS') throw new ErreurWorkflow('erreurs.circuitIntrouvable');
    const etape = circuit.etapes[circuit.indexCourant];
    if (!etape || etape.type !== 'SIGNATURE' || etape.statut !== 'EN_COURS') {
      throw new ErreurWorkflow('erreurs.etapeIntrouvable');
    }
    if (etape.posteAssigneId !== acteur.posteId) throw new ErreurWorkflow('erreurs.posteNonAssigne');
    const poste = await db.postes.get(acteur.posteId);
    if (!poste?.peutSigner) throw new ErreurWorkflow('erreurs.habilitationSignatureRequise');
    const courrier = await db.courriers.get(circuit.courrierId);
    if (!courrier || courrier.sens !== 'SORTANT') throw new ErreurWorkflow('erreurs.courrierIntrouvable');

    const pieces = await db.piecesJointes.where('courrierId').equals(courrier.id).toArray();
    const brouillon = pieces.filter((p) => p.nature === 'BROUILLON').sort((a, b) => b.version - a.version)[0];
    if (!brouillon) throw new ErreurWorkflow('erreurs.documentIntrouvable');

    const horodatage = maintenantISO();
    const pieceSignee: PieceJointe = {
      id: uid(),
      courrierId: courrier.id,
      nom: brouillon.nom.replace(/\.pdf$/i, '') + '-signe-manuscrit.pdf',
      mime: 'application/pdf',
      taille: scan.blob.size,
      contenu: scan.blob,
      version: 1 + Math.max(0, ...pieces.map((p) => p.version)),
      nature: 'VERSION_SIGNEE',
      empreinteSha256: empreinteScan,
      ajouteeParId: acteur.personneId,
      ajouteeLe: horodatage,
    };
    await db.piecesJointes.add(pieceSignee);

    const signatureId = uid();
    await db.signatures.add({
      id: signatureId,
      courrierId: courrier.id,
      pieceJointeId: brouillon.id,
      pieceJointeSigneeId: pieceSignee.id,
      signataireId: acteur.personneId,
      posteId: acteur.posteId,
      date: horodatage,
      imagePng: '',
      empreinteDocument: brouillon.empreinteSha256,
      empreinteSignature: empreinteScan,
      empreintePdfSigne: empreinteScan,
      mode: 'MANUSCRITE',
    });

    etape.statut = 'VALIDEE';
    etape.finLe = horodatage;
    etape.traiteeParId = acteur.personneId;
    etape.commentaire = 'Signature manuscrite (document imprimé puis scanné)';
    await db.circuits.put(circuit);

    await tracer({
      courrierId: courrier.id,
      action: 'SIGNATURE',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      commentaire: etape.commentaire,
      details: { signatureId, mode: 'MANUSCRITE', fichier: scan.nom },
    });

    await activerAPartirDe(circuit, courrier, circuit.indexCourant + 1);
  });
}

export interface ResultatSignatureLot {
  courrierId: ID;
  succes: boolean;
  erreur?: string;
}

/** Signature en lot : préparation (hors transaction) puis une transaction indépendante par courrier. */
export async function signerEnLot(
  circuitIds: ID[],
  acteur: Acteur,
  contexte: ContexteSignature,
): Promise<ResultatSignatureLot[]> {
  const resultats: ResultatSignatureLot[] = [];
  for (const circuitId of circuitIds) {
    try {
      await signer(circuitId, acteur, contexte);
      const circuit = await db.circuits.get(circuitId);
      resultats.push({ courrierId: circuit?.courrierId ?? circuitId, succes: true });
    } catch (erreur) {
      resultats.push({
        courrierId: circuitId,
        succes: false,
        erreur: erreur instanceof ErreurWorkflow ? erreur.cle : 'erreurs.inconnue',
      });
    }
  }
  return resultats;
}

/* ------------------------------------------------------------------ */
/* Expédition                                                           */
/* ------------------------------------------------------------------ */

export interface OptionsExpedition {
  modeEnvoi: ModeEnvoi;
  accuseReception?: boolean;
}

export async function expedier(courrierId: ID, acteur: Acteur, options: OptionsExpedition): Promise<CourrierSortant> {
  return db.transaction('rw', db.tables, async () => {
    const courrier = await db.courriers.get(courrierId);
    if (!courrier || courrier.sens !== 'SORTANT') throw new ErreurWorkflow('erreurs.courrierIntrouvable');
    const sortant = courrier as CourrierSortant;
    if (sortant.statut !== 'SIGNE') throw new ErreurWorkflow('erreurs.expeditionImpossible');

    const numero = await prochainNumero('SORTANT');
    const maintenantHorodatage = maintenantISO();
    sortant.numero = numero;
    sortant.dateExpedition = maintenantHorodatage;
    sortant.modeEnvoi = options.modeEnvoi;
    sortant.accuseReception = options.accuseReception;
    sortant.statut = 'EXPEDIE';
    sortant.misAJourLe = maintenantHorodatage;
    await db.courriers.put(sortant);

    if (sortant.circuitInstanceId) {
      const circuit = await db.circuits.get(sortant.circuitInstanceId);
      const etape = circuit?.etapes[circuit.indexCourant];
      if (circuit && etape?.type === 'EXPEDITION') {
        etape.statut = 'VALIDEE';
        etape.finLe = maintenantHorodatage;
        etape.traiteeParId = acteur.personneId;
        await db.circuits.put(circuit);
        await terminerCircuit(circuit, sortant);
      }
    }

    await tracer({
      courrierId: sortant.id,
      action: 'EXPEDITION',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
      details: { numero, modeEnvoi: options.modeEnvoi },
    });

    if (sortant.reponseAId) {
      const entrant = await db.courriers.get(sortant.reponseAId);
      const circuitEntrant = entrant?.circuitInstanceId ? await db.circuits.get(entrant.circuitInstanceId) : undefined;
      if (entrant && entrant.sens === 'ENTRANT' && circuitEntrant?.statut === 'EN_COURS') {
        // La réponse expédiée vaut traitement : on solde le circuit de l'entrant resté ouvert,
        // ce qui le clôture (terminerCircuit voit la réponse EXPEDIE).
        circuitEntrant.etapes.forEach((e, i) => {
          if (i === circuitEntrant.indexCourant) {
            e.statut = 'VALIDEE';
            e.finLe = maintenantHorodatage;
            e.commentaire = `Réponse expédiée : ${numero}`;
          } else if (e.statut === 'EN_ATTENTE') {
            e.statut = 'IGNOREE';
            e.debutLe = maintenantHorodatage;
            e.finLe = maintenantHorodatage;
          }
        });
        await tracer({
          courrierId: entrant.id,
          action: 'TRAITEMENT',
          acteurId: ACTEUR_SYSTEME,
          posteId: ACTEUR_SYSTEME,
          commentaire: `Réponse expédiée : ${numero}`,
        });
        await terminerCircuit(circuitEntrant, entrant);
      } else if (entrant && entrant.sens === 'ENTRANT' && entrant.statut === 'EN_ATTENTE_REPONSE') {
        const entrantType = entrant as CourrierEntrant;
        entrantType.statut = 'CLOTURE';
        entrantType.misAJourLe = maintenantHorodatage;
        await db.courriers.put(entrantType);
        await tracer({
          courrierId: entrantType.id,
          action: 'CLOTURE',
          acteurId: ACTEUR_SYSTEME,
          posteId: ACTEUR_SYSTEME,
          commentaire: `Réponse expédiée : ${numero}`,
        });
      }
    }

    return sortant;
  });
}

/* ------------------------------------------------------------------ */
/* Actions annexes                                                      */
/* ------------------------------------------------------------------ */

export async function marquerLu(diffusionId: ID, acteur: Acteur): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const diffusion = await db.diffusions.get(diffusionId);
    if (!diffusion) throw new ErreurWorkflow('erreurs.diffusionIntrouvable');
    await db.diffusions.update(diffusionId, { lueParId: acteur.personneId, lueLe: maintenantISO() });
    await tracer({
      courrierId: diffusion.courrierId,
      action: 'LECTURE_DIFFUSION',
      acteurId: acteur.personneId,
      posteId: acteur.posteId,
    });
  });
}

export async function commenter(courrierId: ID, acteur: Acteur, texte: string): Promise<void> {
  await db.transaction('rw', db.tables, () =>
    tracer({ courrierId, action: 'COMMENTAIRE', acteurId: acteur.personneId, posteId: acteur.posteId, commentaire: texte }),
  );
}

export async function ajouterAnnexe(courrierId: ID, acteur: Acteur, fichier: FichierEntree): Promise<void> {
  const empreinteSha256 = await sha256(fichier.blob);
  await db.transaction('rw', db.tables, async () => {
    const pieces = await db.piecesJointes.where('courrierId').equals(courrierId).toArray();
    const version = 1 + Math.max(0, ...pieces.map((p) => p.version));
    await db.piecesJointes.add({
      id: uid(),
      courrierId,
      nom: fichier.nom,
      mime: fichier.mime,
      taille: fichier.blob.size,
      contenu: fichier.blob,
      version,
      nature: 'ANNEXE',
      empreinteSha256,
      ajouteeParId: acteur.personneId,
      ajouteeLe: maintenantISO(),
    });
    await tracer({ courrierId, action: 'PIECE_AJOUTEE', acteurId: acteur.personneId, posteId: acteur.posteId, details: { nom: fichier.nom } });
  });
}

export async function archiver(courrierId: ID, acteur: Acteur): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const courrier = await db.courriers.get(courrierId);
    if (!courrier) throw new ErreurWorkflow('erreurs.courrierIntrouvable');
    courrier.statut = 'ARCHIVE' as never;
    courrier.misAJourLe = maintenantISO();
    await db.courriers.put(courrier);
    await tracer({ courrierId, action: 'ARCHIVAGE', acteurId: acteur.personneId, posteId: acteur.posteId });
  });
}

/* ------------------------------------------------------------------ */
/* Suggestion d'imputation (règle 8.2.13)                               */
/* ------------------------------------------------------------------ */

export interface SuggestionImputation {
  entiteId: ID;
  justification: string;
}

export async function suggererImputation(courrierId: ID): Promise<SuggestionImputation[]> {
  const courrier = await db.courriers.get(courrierId);
  if (!courrier || courrier.sens !== 'ENTRANT') return [];

  const tousEntrants = (await db.courriers.where('sens').equals('ENTRANT').toArray()) as CourrierEntrant[];
  const autres = tousEntrants.filter((c) => c.id !== courrierId && c.entiteTraitanteId);

  const parCorrespondant = autres
    .filter((c) => c.correspondantId === courrier.correspondantId)
    .sort((a, b) => b.dateReception.localeCompare(a.dateReception))
    .slice(0, 10);

  const compter = (liste: CourrierEntrant[]): Map<ID, number> => {
    const compte = new Map<ID, number>();
    for (const c of liste) {
      if (!c.entiteTraitanteId) continue;
      compte.set(c.entiteTraitanteId, (compte.get(c.entiteTraitanteId) ?? 0) + 1);
    }
    return compte;
  };

  const suggestions: SuggestionImputation[] = [];
  const dejaSuggeres = new Set<ID>();

  const compteCorrespondant = compter(parCorrespondant);
  for (const [entiteId, nombre] of [...compteCorrespondant.entries()].sort((a, b) => b[1] - a[1])) {
    if (suggestions.length >= 3) break;
    suggestions.push({
      entiteId,
      justification: `${nombre} des ${parCorrespondant.length} derniers courriers de ce correspondant`,
    });
    dejaSuggeres.add(entiteId);
  }

  if (suggestions.length < 3) {
    const parType = autres
      .filter((c) => c.type === courrier.type && !dejaSuggeres.has(c.entiteTraitanteId!))
      .sort((a, b) => b.dateReception.localeCompare(a.dateReception))
      .slice(0, 10);
    const compteType = compter(parType);
    for (const [entiteId, nombre] of [...compteType.entries()].sort((a, b) => b[1] - a[1])) {
      if (suggestions.length >= 3) break;
      if (dejaSuggeres.has(entiteId)) continue;
      suggestions.push({
        entiteId,
        justification: `${nombre} des ${parType.length} derniers courriers de ce type`,
      });
      dejaSuggeres.add(entiteId);
    }
  }

  return suggestions;
}
