import { db } from '@/db/db';
import type { ActeurCourant } from '@/hooks/useActeur';
import type {
  CircuitInstance,
  Courrier,
  CourrierEntrant,
  CourrierSortant,
  Diffusion,
  EtapeInstance,
  ID,
} from '@/types/models';

export type NiveauAcces = 'COMPLET' | 'SUIVI' | 'MINIMAL' | 'AUCUN';

/** Trois niveaux de lecture selon la confidentialité et le rôle de l'acteur (section 6.4). */
export async function niveauAcces(
  courrier: Courrier,
  acteur: Pick<ActeurCourant, 'personne' | 'poste'>,
): Promise<NiveauAcces> {
  const estAccueilOuBureauOrdre = acteur.poste.role === 'ACCUEIL' || acteur.poste.role === 'BUREAU_ORDRE';

  if (courrier.confidentialite !== 'CONFIDENTIEL') {
    return estAccueilOuBureauOrdre ? 'SUIVI' : 'COMPLET';
  }

  if (courrier.creeParId === acteur.personne.id) return 'COMPLET';
  if (acteur.poste.role === 'DG') return 'COMPLET';

  const [circuit, diffusions] = await Promise.all([
    courrier.circuitInstanceId ? db.circuits.get(courrier.circuitInstanceId) : undefined,
    db.diffusions.where('courrierId').equals(courrier.id).toArray(),
  ]);
  const postesImpliques = new Set<ID>();
  circuit?.etapes.forEach((e) => e.posteAssigneId && postesImpliques.add(e.posteAssigneId));
  diffusions.forEach((d) => postesImpliques.add(d.posteId));
  (await db.tachesConfiees.where('courrierId').equals(courrier.id).toArray()).forEach((t) => postesImpliques.add(t.posteDestinataireId));

  if (postesImpliques.has(acteur.poste.id)) return 'COMPLET';
  if (estAccueilOuBureauOrdre) return 'MINIMAL';
  return 'AUCUN';
}

/** Objet affiché compte tenu du niveau d'accès (masqué en niveau MINIMAL pour un confidentiel). */
export function objetAffiche(courrier: Courrier, niveau: NiveauAcces): string {
  if (courrier.confidentialite === 'CONFIDENTIEL' && niveau === 'MINIMAL') {
    return 'Courrier confidentiel';
  }
  return courrier.objet;
}

export interface TacheCorbeille {
  courrier: Courrier;
  circuit: CircuitInstance;
  etape: EtapeInstance;
}

async function tachesDuPoste(posteId: ID): Promise<TacheCorbeille[]> {
  const circuits = await db.circuits
    .where('posteCourantId')
    .equals(posteId)
    .and((c) => c.statut === 'EN_COURS')
    .toArray();
  const resultats: TacheCorbeille[] = [];
  for (const circuit of circuits) {
    const etape = circuit.etapes[circuit.indexCourant];
    if (!etape) continue;
    const courrier = await db.courriers.get(circuit.courrierId);
    if (courrier) resultats.push({ courrier, circuit, etape });
  }
  return resultats;
}

/** Ma corbeille : tâches en cours hors signature (celles-ci vont au parapheur). */
export async function corbeille(posteId: ID): Promise<TacheCorbeille[]> {
  return (await tachesDuPoste(posteId)).filter((t) => t.etape.type !== 'SIGNATURE');
}

/** Parapheur : courriers en attente de la signature de ce poste. */
export async function parapheur(posteId: ID): Promise<TacheCorbeille[]> {
  return (await tachesDuPoste(posteId)).filter((t) => t.etape.type === 'SIGNATURE');
}

export interface ElementDiffusion {
  diffusion: Diffusion;
  courrier: Courrier;
}

/** Pour information : courriers diffusés à ce poste. */
export async function pourInformation(posteId: ID): Promise<ElementDiffusion[]> {
  const diffusions = await db.diffusions.where('posteId').equals(posteId).toArray();
  const resultats: ElementDiffusion[] = [];
  for (const diffusion of diffusions) {
    const courrier = await db.courriers.get(diffusion.courrierId);
    if (courrier) resultats.push({ diffusion, courrier });
  }
  return resultats.sort((a, b) => b.diffusion.diffuseeLe.localeCompare(a.diffusion.diffuseeLe));
}

export async function courriersAExpedier(): Promise<CourrierSortant[]> {
  const resultats = await db.courriers.where('[sens+statut]').equals(['SORTANT', 'SIGNE']).toArray();
  return resultats as CourrierSortant[];
}

export async function reponsesAttendues(): Promise<CourrierEntrant[]> {
  const resultats = await db.courriers.where('[sens+statut]').equals(['ENTRANT', 'EN_ATTENTE_REPONSE']).toArray();
  return (resultats as CourrierEntrant[]).sort((a, b) =>
    (a.dateLimiteReponse ?? '').localeCompare(b.dateLimiteReponse ?? ''),
  );
}

/** Sortant qui répond à un entrant donné (s'il existe). */
export async function sortantReponseDe(entrantId: ID): Promise<CourrierSortant | undefined> {
  const resultat = await db.courriers.where('reponseAId').equals(entrantId).first();
  return resultat as CourrierSortant | undefined;
}
