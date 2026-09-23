import { db } from '@/db/db';
import { maintenant, maintenantISO, ajouterJours } from '@/services/horloge';
import { niveauAcces, objetAffiche, sortantReponseDe, type NiveauAcces } from '@/services/requetes';
import type { ActeurCourant } from '@/hooks/useActeur';
import type {
  CircuitInstance,
  Courrier,
  CourrierEntrant,
  CourrierSortant,
  ISODate,
  StatutEtape,
} from '@/types/models';

export interface StatutClair {
  cle: string;
  params?: Record<string, string>;
}

export async function statutClair(courrier: Courrier): Promise<StatutClair> {
  if (courrier.sens === 'ENTRANT') {
    const entrant = courrier as CourrierEntrant;
    switch (entrant.statut) {
      case 'ENREGISTRE':
        return { cle: 'suivi.statut.enregistre' };
      case 'EN_TRAITEMENT': {
        const entite = entrant.entiteTraitanteId ? await db.entites.get(entrant.entiteTraitanteId) : undefined;
        return { cle: 'suivi.statut.enTraitement', params: { entite: entite?.libelle ?? '' } };
      }
      case 'EN_VALIDATION':
        return { cle: 'suivi.statut.enValidation' };
      case 'EN_ATTENTE_REPONSE': {
        const sortant = await sortantReponseDe(entrant.id);
        return sortant ? { cle: 'suivi.statut.reponseEnSignature' } : { cle: 'suivi.statut.reponseEnPreparation' };
      }
      case 'CLOTURE': {
        const sortant = await sortantReponseDe(entrant.id);
        if (sortant?.dateExpedition) {
          return {
            cle: 'suivi.statut.reponseEnvoyee',
            params: { date: sortant.dateExpedition, mode: sortant.modeEnvoi ?? '' },
          };
        }
        return { cle: 'suivi.statut.traiteLe', params: { date: entrant.misAJourLe } };
      }
      case 'ARCHIVE':
        return { cle: 'suivi.statut.archive' };
    }
  }

  const sortant = courrier as CourrierSortant;
  switch (sortant.statut) {
    case 'BROUILLON':
      return { cle: 'suivi.statut.brouillon' };
    case 'EN_VALIDATION':
      return { cle: 'suivi.statut.enValidation' };
    case 'REJETE':
      return { cle: 'suivi.statut.rejete' };
    case 'SIGNE':
      return { cle: 'suivi.statut.signe' };
    case 'EXPEDIE':
      return { cle: 'suivi.statut.expedieLe', params: { date: sortant.dateExpedition ?? '' } };
    case 'ARCHIVE':
      return { cle: 'suivi.statut.archive' };
  }
}

export interface EtapeAffichee {
  libelle: string;
  entite?: string;
  poste?: string;
  personne?: string;
  statut: StatutEtape;
  debutLe?: ISODate;
  finLe?: ISODate;
  echeance?: ISODate;
  enRetard: boolean;
}

export async function construireParcours(circuit: CircuitInstance, avecPersonnes: boolean): Promise<EtapeAffichee[]> {
  const maintenantDate = maintenant();
  const resultat: EtapeAffichee[] = [];

  for (const etape of circuit.etapes) {
    let poste: string | undefined;
    let entite: string | undefined;
    let personne: string | undefined;

    if (etape.posteAssigneId) {
      const p = await db.postes.get(etape.posteAssigneId);
      poste = p?.libelle;
      if (p) entite = (await db.entites.get(p.entiteId))?.libelle;
    }
    if (avecPersonnes && etape.traiteeParId) {
      const p = await db.personnes.get(etape.traiteeParId);
      personne = p ? `${p.prenom} ${p.nom}` : undefined;
    }

    resultat.push({
      libelle: etape.libelle,
      entite,
      poste,
      personne,
      statut: etape.statut,
      debutLe: etape.debutLe,
      finLe: etape.finLe,
      echeance: etape.echeance,
      enRetard: etape.statut === 'EN_COURS' && !!etape.echeance && new Date(etape.echeance) < maintenantDate,
    });
  }
  return resultat;
}

function delaisRestants(circuit: CircuitInstance): number {
  let total = 0;
  for (let i = Math.max(circuit.indexCourant, 0); i < circuit.etapes.length; i++) {
    const etape = circuit.etapes[i];
    if (etape.statut === 'IGNOREE' || etape.statut === 'VALIDEE') continue;
    total += etape.delaiJours;
  }
  return total;
}

/** Réponse attendue = maintenant + délais restants du circuit courant (+ circuit sortant standard si non encore rédigée). */
export async function dateReponseEstimee(entrant: CourrierEntrant): Promise<ISODate | undefined> {
  if (!entrant.reponseAttendue) return undefined;
  if (entrant.statut === 'CLOTURE' || entrant.statut === 'ARCHIVE') return undefined;

  let jours = 0;

  if (entrant.statut === 'EN_ATTENTE_REPONSE') {
    const sortant = await sortantReponseDe(entrant.id);
    if (sortant?.circuitInstanceId) {
      const circuit = await db.circuits.get(sortant.circuitInstanceId);
      if (circuit) jours += delaisRestants(circuit);
    } else {
      const modeles = (await db.modelesCircuit.where('sens').equals('SORTANT').toArray()).filter((m) => m.actif);
      const parDefaut = modeles.find((m) => m.typesCourrier.length === 0);
      jours += parDefaut?.etapes.reduce((somme, e) => somme + e.delaiJours, 0) ?? 0;
    }
  } else if (entrant.circuitInstanceId) {
    const circuit = await db.circuits.get(entrant.circuitInstanceId);
    if (circuit) jours += delaisRestants(circuit);
  }

  return ajouterJours(maintenantISO(), jours);
}

export interface FicheSuivi {
  courrier: Courrier;
  niveau: NiveauAcces;
  objet: string;
  statut: StatutClair;
  detenteur?: { entite?: string; poste?: string; depuis?: ISODate };
  echeanceActuelle?: ISODate;
  enRetard: boolean;
  dateLimiteReponse?: ISODate;
  dateReponseEstimee?: ISODate;
  parcours: EtapeAffichee[];
}

/** Fiche de suivi interne (section 9.3), filtrée par le niveau d'accès de l'acteur. */
export async function obtenirFicheSuivi(
  codeSuivi: string,
  acteur: Pick<ActeurCourant, 'personne' | 'poste'>,
): Promise<FicheSuivi | undefined> {
  const courrier = await db.courriers.where('codeSuivi').equals(codeSuivi.trim().toUpperCase()).first();
  if (!courrier) return undefined;

  const niveau = await niveauAcces(courrier, acteur);
  if (niveau === 'AUCUN') return undefined;

  const circuit = courrier.circuitInstanceId ? await db.circuits.get(courrier.circuitInstanceId) : undefined;
  const parcours = circuit ? await construireParcours(circuit, niveau !== 'MINIMAL') : [];
  const etapeActuelle = circuit?.etapes[circuit.indexCourant];

  let detenteur: FicheSuivi['detenteur'];
  if (etapeActuelle?.posteAssigneId) {
    const poste = await db.postes.get(etapeActuelle.posteAssigneId);
    const entite = poste ? await db.entites.get(poste.entiteId) : undefined;
    detenteur = { entite: entite?.libelle, poste: poste?.libelle, depuis: etapeActuelle.debutLe };
  }

  return {
    courrier,
    niveau,
    objet: objetAffiche(courrier, niveau),
    statut: await statutClair(courrier),
    detenteur,
    echeanceActuelle: etapeActuelle?.echeance,
    enRetard:
      !!etapeActuelle?.echeance &&
      etapeActuelle.statut === 'EN_COURS' &&
      new Date(etapeActuelle.echeance) < maintenant(),
    dateLimiteReponse: courrier.sens === 'ENTRANT' ? (courrier as CourrierEntrant).dateLimiteReponse : undefined,
    dateReponseEstimee:
      courrier.sens === 'ENTRANT' ? await dateReponseEstimee(courrier as CourrierEntrant) : undefined,
    parcours,
  };
}

export interface FicheSuiviPublique {
  numero: string | null;
  codeSuivi: string;
  statut: StatutClair;
  objet?: string;
  entiteDetentrice?: string;
  dateReception?: ISODate;
  dateReponseEstimee?: ISODate;
}

/**
 * Portail usager (section 9.4) : accès sans connexion, protégé par les 3
 * premières lettres du nom du correspondant ou du déposant.
 */
export async function rechercherSuiviPublic(
  codeSuivi: string,
  debutIdentifiant: string,
): Promise<FicheSuiviPublique | null> {
  const courrier = await db.courriers.where('codeSuivi').equals(codeSuivi.trim().toUpperCase()).first();
  if (!courrier) return null;

  const correspondant = await db.correspondants.get(courrier.correspondantId);
  const nomDeposant = courrier.sens === 'ENTRANT' ? (courrier as CourrierEntrant).deposant?.nom : undefined;
  const candidats = [correspondant?.nom, correspondant?.organisation, nomDeposant]
    .filter((v): v is string => !!v)
    .map((v) => v.toLowerCase());

  const prefixe = debutIdentifiant.trim().toLowerCase().slice(0, 3);
  const correspond = (nom: string) => nom.split(/\s+/).some((mot) => mot.startsWith(prefixe));
  if (prefixe.length < 3 || !candidats.some(correspond)) return null;

  const circuit = courrier.circuitInstanceId ? await db.circuits.get(courrier.circuitInstanceId) : undefined;
  const etapeActuelle = circuit?.etapes[circuit.indexCourant];
  const posteActuel = etapeActuelle?.posteAssigneId ? await db.postes.get(etapeActuelle.posteAssigneId) : undefined;
  const entite = posteActuel ? await db.entites.get(posteActuel.entiteId) : undefined;

  return {
    numero: courrier.numero,
    codeSuivi: courrier.codeSuivi,
    statut: await statutClair(courrier),
    objet: objetAffiche(courrier, courrier.confidentialite === 'CONFIDENTIEL' ? 'MINIMAL' : 'COMPLET'),
    entiteDetentrice: entite?.libelle,
    dateReception: courrier.sens === 'ENTRANT' ? (courrier as CourrierEntrant).dateReception : undefined,
    dateReponseEstimee:
      courrier.sens === 'ENTRANT' ? await dateReponseEstimee(courrier as CourrierEntrant) : undefined,
  };
}
