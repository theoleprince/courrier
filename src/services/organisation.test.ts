import { describe, expect, it } from 'vitest';
import { direction, enfantsDirects, posteResponsable, superieurHierarchique } from '@/services/organisation';
import type { Entite, Poste } from '@/types/models';

const dg: Entite = { id: 'dg', code: 'DG', libelle: 'Direction générale', type: 'DIRECTION', parentId: null, actif: true };
const daf: Entite = { id: 'daf', code: 'DAF', libelle: 'DAF', type: 'DIRECTION', parentId: 'dg', actif: true };
const cpt: Entite = { id: 'cpt', code: 'CPT', libelle: 'Comptabilité', type: 'SERVICE', parentId: 'daf', actif: true };
const entites = [dg, daf, cpt];

const posteDG: Poste = { id: 'p-dg', libelle: 'DG', entiteId: 'dg', role: 'DG', estResponsable: true, peutSigner: true, actif: true };
const posteDAF: Poste = { id: 'p-daf', libelle: 'DAF', entiteId: 'daf', role: 'DIRECTEUR', estResponsable: true, peutSigner: true, actif: true };
const posteChefCPT: Poste = { id: 'p-chef-cpt', libelle: 'Chef CPT', entiteId: 'cpt', role: 'CHEF', estResponsable: true, peutSigner: false, actif: true };
const posteAgentCPT: Poste = { id: 'p-agent-cpt', libelle: 'Agent CPT', entiteId: 'cpt', role: 'AGENT', estResponsable: false, peutSigner: false, actif: true };
const postes = [posteDG, posteDAF, posteChefCPT, posteAgentCPT];

describe('direction()', () => {
  it('remonte au premier ancêtre de type DIRECTION', () => {
    expect(direction('cpt', entites)?.id).toBe('daf');
    expect(direction('daf', entites)?.id).toBe('daf');
    expect(direction('dg', entites)?.id).toBe('dg');
  });
});

describe('superieurHierarchique()', () => {
  it("pour un poste non responsable, renvoie le responsable de son entité", () => {
    expect(superieurHierarchique(posteAgentCPT, entites, postes)?.id).toBe('p-chef-cpt');
  });

  it("pour un poste responsable, renvoie le responsable de l'entité parente", () => {
    expect(superieurHierarchique(posteChefCPT, entites, postes)?.id).toBe('p-daf');
    expect(superieurHierarchique(posteDAF, entites, postes)?.id).toBe('p-dg');
  });

  it("le DG (racine, responsable) n'a pas de supérieur", () => {
    expect(superieurHierarchique(posteDG, entites, postes)).toBeUndefined();
  });
});

describe('posteResponsable() / enfantsDirects()', () => {
  it('retrouve le responsable actif d’une entité', () => {
    expect(posteResponsable('cpt', postes)?.id).toBe('p-chef-cpt');
  });

  it('liste les entités enfants directes', () => {
    expect(enfantsDirects('dg', entites).map((e) => e.id)).toEqual(['daf']);
    expect(enfantsDirects(null, entites).map((e) => e.id)).toEqual(['dg']);
  });
});
