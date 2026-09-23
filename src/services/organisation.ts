import { db } from '@/db/db';
import { uid } from '@/services/crypto';
import { ErreurWorkflow } from '@/services/erreurs';
import { MOT_DE_PASSE_DEFAUT } from '@/services/auth';
import type { Entite, ID, Personne, Poste, RoleSysteme, TypeEntite } from '@/types/models';

/** « Direction » d'une entité = premier ancêtre (elle-même incluse) de type DIRECTION. */
export function direction(entiteId: ID, entites: Entite[]): Entite | undefined {
  const parId = new Map(entites.map((e) => [e.id, e]));
  let courante = parId.get(entiteId);
  while (courante) {
    if (courante.type === 'DIRECTION') return courante;
    courante = courante.parentId ? parId.get(courante.parentId) : undefined;
  }
  return undefined;
}

export function posteResponsable(entiteId: ID, postes: Poste[]): Poste | undefined {
  return postes.find((p) => p.entiteId === entiteId && p.estResponsable && p.actif);
}

/**
 * « Supérieur hiérarchique » d'un poste = poste responsable de son entité ;
 * si le poste est lui-même responsable, poste responsable de l'entité parente.
 */
export function superieurHierarchique(
  poste: Poste,
  entites: Entite[],
  postes: Poste[],
): Poste | undefined {
  const entite = entites.find((e) => e.id === poste.entiteId);
  if (!entite) return undefined;
  if (!poste.estResponsable) {
    return posteResponsable(entite.id, postes);
  }
  if (!entite.parentId) return undefined;
  return posteResponsable(entite.parentId, postes);
}

export function enfantsDirects(entiteId: ID | null, entites: Entite[]): Entite[] {
  return entites.filter((e) => e.parentId === entiteId);
}

export function titulaire(posteId: ID, personnes: Personne[]): Personne | undefined {
  return personnes.find((p) => p.posteId === posteId && p.actif);
}

export function interimaires(posteId: ID, personnes: Personne[]): Personne[] {
  return personnes.filter((p) => p.interimPosteIds.includes(posteId) && p.actif);
}

/** Postes (titulaire ou intérim) qu'une personne peut activement occuper. */
export async function postesDisponibles(personne: Personne): Promise<Poste[]> {
  const ids = [personne.posteId, ...personne.interimPosteIds].filter((id): id is ID => id !== null);
  const postes = await db.postes.bulkGet(ids);
  return postes.filter((p): p is Poste => !!p && p.actif);
}

/* ------------------------------------------------------------------ */
/* CRUD administration (section 6.1) — la suppression n'est jamais       */
/* proposée : seule la désactivation l'est, ce qui évite d'avoir à       */
/* vérifier toutes les références (circuits en cours, modèles actifs…). */
/* ------------------------------------------------------------------ */

export interface DonneesEntite {
  code: string;
  libelle: string;
  type: TypeEntite;
  parentId: ID | null;
}

export async function creerEntite(data: DonneesEntite): Promise<Entite> {
  if (data.type === 'SERVICE' && !data.parentId) {
    throw new ErreurWorkflow('erreurs.serviceParentObligatoire');
  }
  const entite: Entite = { id: uid(), actif: true, ...data };
  await db.entites.add(entite);
  return entite;
}

/**
 * Modifie une entité (code, libellé, type, parent). Refuse un service sans
 * parent et tout rattachement à elle-même ou à l'une de ses descendantes.
 */
export async function modifierEntite(id: ID, data: DonneesEntite): Promise<void> {
  if (data.type === 'SERVICE' && !data.parentId) {
    throw new ErreurWorkflow('erreurs.serviceParentObligatoire');
  }
  if (data.parentId) {
    const entites = await db.entites.toArray();
    const parId = new Map(entites.map((e) => [e.id, e]));
    let courante = parId.get(data.parentId);
    while (courante) {
      if (courante.id === id) throw new ErreurWorkflow('erreurs.parentInvalide');
      courante = courante.parentId ? parId.get(courante.parentId) : undefined;
    }
  }
  await db.entites.update(id, { ...data });
}

export async function desactiverEntite(id: ID): Promise<void> {
  await db.entites.update(id, { actif: false });
}

/** Réactive une entité ; refusé tant que son entité parente est désactivée. */
export async function reactiverEntite(id: ID): Promise<void> {
  const entite = await db.entites.get(id);
  if (!entite) return;
  if (entite.parentId) {
    const parent = await db.entites.get(entite.parentId);
    if (parent && !parent.actif) throw new ErreurWorkflow('erreurs.parentInactif');
  }
  await db.entites.update(id, { actif: true });
}

export interface DonneesPoste {
  libelle: string;
  entiteId: ID;
  role: RoleSysteme;
  estResponsable: boolean;
  peutSigner: boolean;
}

/** Un seul poste responsable actif par entité : le précédent est automatiquement rétrogradé. */
export async function creerPoste(data: DonneesPoste): Promise<Poste> {
  return db.transaction('rw', db.tables, async () => {
    if (data.estResponsable) {
      const existants = await db.postes.where('entiteId').equals(data.entiteId).toArray();
      for (const p of existants.filter((p) => p.estResponsable && p.actif)) {
        await db.postes.update(p.id, { estResponsable: false });
      }
    }
    const poste: Poste = { id: uid(), actif: true, ...data };
    await db.postes.add(poste);
    return poste;
  });
}

export async function desactiverPoste(id: ID): Promise<void> {
  await db.postes.update(id, { actif: false });
}

export interface DonneesPersonne {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  posteId: ID | null;
  interimPosteIds?: ID[];
}

export async function creerPersonne(data: DonneesPersonne): Promise<Personne> {
  const personne: Personne = {
    id: uid(),
    actif: true,
    interimPosteIds: data.interimPosteIds ?? [],
    motDePasse: MOT_DE_PASSE_DEFAUT,
    ...data,
  };
  await db.personnes.add(personne);
  return personne;
}

export async function desactiverPersonne(id: ID): Promise<void> {
  await db.personnes.update(id, { actif: false });
}
