export type ID = string;
export type ISODate = string;

/* ----- Organisation ----- */

export type TypeEntite = 'DIRECTION' | 'DEPARTEMENT' | 'SERVICE';

export interface Entite {
  id: ID;
  code: string;
  libelle: string;
  type: TypeEntite;
  parentId: ID | null;
  actif: boolean;
}

export type RoleSysteme =
  | 'ACCUEIL'
  | 'BUREAU_ORDRE'
  | 'AGENT'
  | 'CHEF'
  | 'DIRECTEUR'
  | 'DG'
  | 'ADMIN';

export interface Poste {
  id: ID;
  libelle: string;
  entiteId: ID;
  role: RoleSysteme;
  estResponsable: boolean; // un seul par entité
  peutSigner: boolean;
  actif: boolean;
}

export interface Personne {
  id: ID;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  posteId: ID | null;
  interimPosteIds: ID[];
  actif: boolean;
  derniereSignaturePng?: string;
  /** Mot de passe en clair (POC uniquement, aucune valeur de sécurité réelle — voir DECISIONS.md). */
  motDePasse?: string;
}

export interface Correspondant {
  id: ID;
  nom: string;
  organisation?: string;
  adresse?: string;
  email?: string;
  telephone?: string;
  categorie: 'ENTREPRISE' | 'ADMINISTRATION' | 'PARTICULIER';
}

/* ----- Courrier ----- */

export type Sens = 'ENTRANT' | 'SORTANT';
export type TypeCourrier =
  | 'LETTRE'
  | 'FACTURE'
  | 'CONVOCATION'
  | 'NOTE'
  | 'DEMANDE'
  | 'RECLAMATION'
  | 'AUTRE';
export type Priorite = 'NORMALE' | 'URGENTE' | 'TRES_URGENTE';
export type Confidentialite = 'PUBLIC' | 'INTERNE' | 'CONFIDENTIEL';
export type StatutEntrant =
  | 'ENREGISTRE'
  | 'EN_TRAITEMENT'
  | 'EN_VALIDATION'
  | 'EN_ATTENTE_REPONSE'
  | 'CLOTURE'
  | 'ARCHIVE';
export type StatutSortant =
  | 'BROUILLON'
  | 'EN_VALIDATION'
  | 'REJETE'
  | 'SIGNE'
  | 'EXPEDIE'
  | 'ARCHIVE';
export type ModeEnvoi = 'MAIN_PROPRE' | 'POSTE' | 'EMAIL' | 'COURSIER';
export type ModeDepot = 'GUICHET' | 'POSTE' | 'COURSIER' | 'EMAIL';

/** Personne physique qui a déposé le courrier au guichet (peut différer du correspondant). */
export interface Deposant {
  nom: string;
  telephone?: string;
  piece?: string;
}

interface CourrierBase {
  id: ID;
  sens: Sens;
  numero: string | null; // ARR-2026-000001 / DEP-2026-000001
  codeSuivi: string; // ex. K7MQ-4T2X, communiqué à l'usager
  objet: string;
  type: TypeCourrier;
  priorite: Priorite;
  confidentialite: Confidentialite;
  correspondantId: ID;
  entiteTraitanteId: ID | null;
  circuitInstanceId: ID | null;
  motsCles: string[];
  cote?: string;
  creeParId: ID;
  creeLe: ISODate;
  misAJourLe: ISODate;
}

export interface CourrierEntrant extends CourrierBase {
  sens: 'ENTRANT';
  statut: StatutEntrant;
  dateReception: ISODate;
  dateCourrier?: ISODate;
  referenceExpediteur?: string;
  modeDepot: ModeDepot;
  deposant?: Deposant;
  reponseAttendue: boolean;
  dateLimiteReponse?: ISODate;
}

export interface CourrierSortant extends CourrierBase {
  sens: 'SORTANT';
  statut: StatutSortant;
  reponseAId: ID | null;
  modeleLettreId?: ID;
  dateExpedition?: ISODate;
  modeEnvoi?: ModeEnvoi;
  accuseReception?: boolean;
}

export type Courrier = CourrierEntrant | CourrierSortant;

export type NaturePieceJointe = 'SCAN' | 'BROUILLON' | 'VERSION_SIGNEE' | 'ANNEXE';

export interface PieceJointe {
  id: ID;
  courrierId: ID;
  nom: string;
  mime: string;
  taille: number;
  contenu: Blob;
  version: number;
  nature: NaturePieceJointe;
  empreinteSha256: string;
  texteOcr?: string; // optionnel, indexé par la recherche
  ajouteeParId: ID;
  ajouteeLe: ISODate;
}

/* ----- Circuits ----- */

export type TypeEtape =
  | 'IMPUTATION'
  | 'TRAITEMENT'
  | 'VISA'
  | 'VALIDATION'
  | 'SIGNATURE'
  | 'EXPEDITION';

export type RoleCible =
  | 'BUREAU_ORDRE'
  | 'REDACTEUR'
  | 'RESPONSABLE_ENTITE_TRAITANTE'
  | 'DIRECTEUR_ENTITE_TRAITANTE';

export interface EtapeModele {
  ordre: number;
  type: TypeEtape;
  libelle: string;
  posteCibleId?: ID; // exactement une des deux (posteCibleId / roleCible)
  roleCible?: RoleCible;
  delaiJours: number;
  sauterSiRedacteur: boolean;
}

export interface ModeleCircuit {
  id: ID;
  libelle: string;
  sens: Sens;
  typesCourrier: TypeCourrier[];
  etapes: EtapeModele[];
  actif: boolean;
}

export type StatutEtape = 'EN_ATTENTE' | 'EN_COURS' | 'VALIDEE' | 'REJETEE' | 'IGNOREE';

export interface EtapeInstance extends EtapeModele {
  statut: StatutEtape;
  posteAssigneId?: ID;
  traiteeParId?: ID;
  debutLe?: ISODate;
  finLe?: ISODate;
  echeance?: ISODate;
  commentaire?: string;
  escaladeeLe?: ISODate;
}

export interface CircuitInstance {
  id: ID;
  courrierId: ID;
  modeleId: ID;
  etapes: EtapeInstance[];
  indexCourant: number;
  posteCourantId: ID | null;
  statut: 'EN_COURS' | 'TERMINE' | 'REJETE';
  demarreLe: ISODate;
  termineLe?: ISODate;
}

/* ----- Collaboration ----- */

export interface Diffusion {
  id: ID;
  courrierId: ID;
  posteId: ID;
  diffuseeParId: ID;
  diffuseeLe: ISODate;
  lueParId?: ID;
  lueLe?: ISODate;
}

export type TypeNotification =
  | 'NOUVELLE_TACHE'
  | 'RAPPEL_ECHEANCE'
  | 'RETARD'
  | 'ESCALADE'
  | 'DIFFUSION'
  | 'REJET'
  | 'SIGNE'
  | 'EXPEDIE'
  | 'REPONSE_ENVOYEE';

export interface Notification {
  id: ID;
  posteId: ID;
  courrierId: ID;
  type: TypeNotification;
  cle: string; // dédoublonnage, ex. `RAPPEL:${circuitId}:${index}`
  message: string;
  creeLe: ISODate;
  lueLe?: ISODate;
}

/* ----- Modèles de lettres ----- */

export interface ModeleLettre {
  id: ID;
  libelle: string;
  langue: 'fr' | 'en';
  typesCourrier: TypeCourrier[];
  objet: string; // avec variables
  corps: string; // texte avec variables {{...}}
}

/* ----- Traçabilité ----- */

export type ActionHistorique =
  | 'ENREGISTREMENT'
  | 'CREATION'
  | 'CIRCUIT_DEMARRE'
  | 'IMPUTATION'
  | 'TRAITEMENT'
  | 'VISA'
  | 'VALIDATION'
  | 'SIGNATURE'
  | 'REJET'
  | 'RESOUMISSION'
  | 'ETAPE_IGNOREE'
  | 'EXPEDITION'
  | 'CIRCUIT_TERMINE'
  | 'CLOTURE'
  | 'ARCHIVAGE'
  | 'COMMENTAIRE'
  | 'PIECE_AJOUTEE'
  | 'DIFFUSION'
  | 'LECTURE_DIFFUSION'
  | 'ESCALADE'
  | 'CONSULTATION_SUIVI'
  | 'RECEPISSE_IMPRIME';

export interface Historique {
  id: ID;
  sequence: number; // ordre global strict
  courrierId: ID;
  action: ActionHistorique;
  acteurId: ID;
  posteId: ID; // 'systeme' pour les actions automatiques
  date: ISODate;
  commentaire?: string;
  details?: Record<string, unknown>;
  empreintePrecedente: string; // empreinte de l'entrée sequence - 1 ('0'.repeat(64) pour la première)
  empreinte: string; // sha256Sync(empreintePrecedente + JSON canonique de l'entrée sans empreinte)
}

export interface Signature {
  id: ID;
  courrierId: ID;
  pieceJointeId: ID;
  pieceJointeSigneeId: ID | null;
  signataireId: ID;
  posteId: ID;
  date: ISODate;
  imagePng: string;
  empreinteDocument: string;
  empreinteSignature: string;
  empreintePdfSigne: string | null; // pour la vérification d'un PDF reçu
  /** MANUSCRITE : document imprimé, signé à la main puis scanné (imagePng vide). Absent = électronique. */
  mode?: 'ELECTRONIQUE' | 'MANUSCRITE';
}

/* ----- Paramètres ----- */

export interface Parametres {
  id: 'global';
  nomOrganisation: string;
  sigle: string;
  adresse: string;
  telephone?: string;
  email?: string;
  logoPng?: string; // data URL
  couleurPrimaire: string; // hex, appliquée en variable CSS
  langue: 'fr' | 'en';
  delaiEscaladeJours: number; // retard avant escalade (défaut 2)
  modeDemo: boolean;
  decalageHorlogeMinutes: number; // horloge de démo
}

export interface Sequence {
  id: string;
  valeur: number;
} // `${Sens}-${annee}` et 'JOURNAL'

/** Acteur au nom duquel une action métier est effectuée. */
export interface Acteur {
  personneId: ID;
  posteId: ID;
}
