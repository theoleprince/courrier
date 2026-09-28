// @vitest-environment node
// Environnement Node : Blob.arrayBuffer() et crypto.subtle réels, nécessaires aux empreintes des pièces jointes.
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { viderDb } from '@/tests/dbTestUtils';
import { validerEtape } from '@/services/workflow';
import { annulerTache, attacherProjetReponse, confierTache, peutSoumettreProjet, rendreCompte, tachesConfieesA } from '@/services/taches';
import { sha256 } from '@/services/crypto';
import { niveauAcces } from '@/services/requetes';
import type { CircuitInstance, Courrier, EtapeInstance, PieceJointe } from '@/types/models';

afterEach(viderDb);

const dg = { personneId: 'paul', posteId: 'poste-dg' };
const assistante = { personneId: 'nadege', posteId: 'poste-assistante' };

function etape(ordre: number, type: EtapeInstance['type'], statut: EtapeInstance['statut'], posteAssigneId?: string): EtapeInstance {
  return { ordre, type, libelle: type, delaiJours: 1, sauterSiRedacteur: false, statut, posteAssigneId } as EtapeInstance;
}

/** Entrant confidentiel arrivé à l'étape « Validation » du DG. */
async function preparer(): Promise<void> {
  await db.postes.bulkPut([
    { id: 'poste-dg', libelle: 'Directeur général', entiteId: 'dg', role: 'DG', estResponsable: true, peutSigner: true, actif: true },
    { id: 'poste-assistante', libelle: 'Assistante de direction', entiteId: 'dg', role: 'AGENT', estResponsable: false, peutSigner: false, actif: true },
  ]);
  await db.circuits.put({
    id: 'circuit',
    courrierId: 'entrant',
    modeleId: 'modele',
    etapes: [etape(1, 'IMPUTATION', 'VALIDEE'), etape(2, 'VALIDATION', 'EN_COURS', 'poste-dg')],
    indexCourant: 1,
    posteCourantId: 'poste-dg',
    statut: 'EN_COURS',
    demarreLe: '2026-09-01T00:00:00.000Z',
  } as CircuitInstance);
  await db.courriers.put({
    id: 'entrant',
    sens: 'ENTRANT',
    statut: 'EN_VALIDATION',
    codeSuivi: 'ENT-1',
    confidentialite: 'CONFIDENTIEL',
    creeParId: 'carine',
    reponseAttendue: false,
    circuitInstanceId: 'circuit',
  } as unknown as Courrier);
}

describe('tâches confiées', () => {
  it("le DG confie le travail à son assistante, qui rend compte, puis le DG valide son étape", async () => {
    await preparer();

    const tache = await confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'Préparer un projet de réponse', delaiJours: 2 });

    // L'assistante voit la tâche dans sa corbeille et accède au courrier confidentiel.
    expect((await tachesConfieesA('poste-assistante')).map((e) => e.tache.id)).toEqual([tache.id]);
    const courrier = (await db.courriers.get('entrant'))!;
    expect(await niveauAcces(courrier, { personne: { id: 'nadege' }, poste: { id: 'poste-assistante', role: 'AGENT' } } as never)).toBe('COMPLET');
    expect((await db.notifications.where('posteId').equals('poste-assistante').toArray()).map((n) => n.type)).toContain('TACHE_CONFIEE');

    // L'étape reste au DG et ne peut pas être close tant que la tâche est ouverte.
    await expect(validerEtape('circuit', dg)).rejects.toThrow('erreurs.tacheConfieeEnCours');
    expect((await db.circuits.get('circuit'))?.posteCourantId).toBe('poste-dg');

    await rendreCompte(tache.id, assistante, {
      texte: 'Projet joint',
      fichier: { blob: new Blob(['projet']), nom: 'projet.txt', mime: 'text/plain' },
    });
    const rendue = await db.tachesConfiees.get(tache.id);
    expect(rendue?.statut).toBe('RENDUE');
    expect(rendue?.pieceJointeId).toBeTruthy();
    expect(await tachesConfieesA('poste-assistante')).toEqual([]);
    expect((await db.notifications.where('posteId').equals('poste-dg').toArray()).map((n) => n.type)).toContain('COMPTE_RENDU');

    await validerEtape('circuit', dg);
    expect((await db.circuits.get('circuit'))?.statut).toBe('TERMINE');

    const actions = (await db.historique.where('courrierId').equals('entrant').toArray()).map((h) => h.action);
    expect(actions).toEqual(expect.arrayContaining(['TACHE_CONFIEE', 'COMPTE_RENDU', 'VALIDATION']));
  });

  it("seul le titulaire de l'étape peut confier, et seul le destinataire peut rendre compte", async () => {
    await preparer();

    await expect(confierTache('circuit', assistante, { posteDestinataireId: 'poste-dg', note: 'x' })).rejects.toThrow('erreurs.posteNonAssigne');
    await expect(confierTache('circuit', dg, { posteDestinataireId: 'poste-dg', note: 'x' })).rejects.toThrow('erreurs.confierASoiMeme');
    await expect(confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: '  ' })).rejects.toThrow('erreurs.noteObligatoire');

    const tache = await confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'À traiter' });
    await expect(rendreCompte(tache.id, dg, { texte: 'fait' })).rejects.toThrow('erreurs.posteNonAssigne');
    await expect(rendreCompte(tache.id, assistante, { texte: ' ' })).rejects.toThrow('erreurs.compteRenduObligatoire');
  });

  it("un poste d'accueil ou de bureau d'ordre destinataire d'une tâche a l'accès complet au courrier", async () => {
    await preparer();
    await db.courriers.update('entrant', { confidentialite: 'INTERNE' });
    await db.postes.put({ id: 'poste-bo', libelle: 'Chef du bureau d’ordre', entiteId: 'bo', role: 'BUREAU_ORDRE', estResponsable: true, peutSigner: false, actif: true });
    const agentBO = { personne: { id: 'ernest' }, poste: { id: 'poste-bo', role: 'BUREAU_ORDRE' } } as never;

    expect(await niveauAcces((await db.courriers.get('entrant'))!, agentBO)).toBe('SUIVI');
    await confierTache('circuit', dg, { posteDestinataireId: 'poste-bo', note: 'Classer et répondre' });
    expect(await niveauAcces((await db.courriers.get('entrant'))!, agentBO)).toBe('COMPLET');
  });

  it('le DG peut reprendre la main en annulant la tâche', async () => {
    await preparer();
    const tache = await confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'À traiter' });

    await expect(annulerTache(tache.id, assistante)).rejects.toThrow('erreurs.posteNonAssigne');
    await annulerTache(tache.id, dg);

    expect((await db.tachesConfiees.get(tache.id))?.statut).toBe('ANNULEE');
    await expect(rendreCompte(tache.id, assistante, { texte: 'trop tard' })).rejects.toThrow('erreurs.tacheIntrouvable');
    await validerEtape('circuit', dg);
    expect((await db.circuits.get('circuit'))?.statut).toBe('TERMINE');
  });
});

/** Sortant au parapheur du DG, avec son brouillon PDF v1. */
async function preparerSortant(): Promise<void> {
  await preparer();
  const contenu = new Blob(['%PDF-1.4 v1'], { type: 'application/pdf' });
  await db.piecesJointes.put({
    id: 'brouillon-v1',
    courrierId: 'sortant',
    nom: 'lettre.pdf',
    mime: 'application/pdf',
    taille: contenu.size,
    contenu,
    version: 1,
    nature: 'BROUILLON',
    empreinteSha256: await sha256(contenu),
    ajouteeParId: 'rodrigue',
    ajouteeLe: '2026-09-01T00:00:00.000Z',
  } as PieceJointe);
  await db.circuits.put({
    id: 'circuit-sortant',
    courrierId: 'sortant',
    modeleId: 'modele',
    etapes: [etape(1, 'SIGNATURE', 'EN_COURS', 'poste-dg'), etape(2, 'EXPEDITION', 'EN_ATTENTE')],
    indexCourant: 0,
    posteCourantId: 'poste-dg',
    statut: 'EN_COURS',
    demarreLe: '2026-09-01T00:00:00.000Z',
  } as CircuitInstance);
  await db.courriers.put({
    id: 'sortant',
    sens: 'SORTANT',
    statut: 'EN_SIGNATURE',
    codeSuivi: 'SOR-1',
    confidentialite: 'INTERNE',
    creeParId: 'rodrigue',
    circuitInstanceId: 'circuit-sortant',
  } as unknown as Courrier);
}

describe('instructions des tâches confiées', () => {
  it('les instructions proposées dépendent du sens du courrier', async () => {
    await preparerSortant();
    await expect(confierTache('circuit-sortant', dg, { posteDestinataireId: 'poste-assistante', note: 'x', nature: 'PROJET_REPONSE' })).rejects.toThrow('erreurs.natureTacheImpossible');
    await expect(confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'x', nature: 'CORRIGER_DOCUMENT' })).rejects.toThrow('erreurs.natureTacheImpossible');
  });

  it('corriger le document : la version corrigée devient le brouillon à signer', async () => {
    await preparerSortant();
    const tache = await confierTache('circuit-sortant', dg, { posteDestinataireId: 'poste-assistante', note: 'Corriger la date', nature: 'CORRIGER_DOCUMENT' });

    await expect(rendreCompte(tache.id, assistante, { texte: '' })).rejects.toThrow('erreurs.versionCorrigeeObligatoire');
    await rendreCompte(tache.id, assistante, { texte: '', versionCorrigee: { blob: new Blob(['%PDF-1.4 v2'], { type: 'application/pdf' }), nom: 'lettre-v2.pdf', mime: 'application/pdf' } });

    const rendue = (await db.tachesConfiees.get(tache.id))!;
    expect(rendue.compteRendu).toBe('Version corrigée déposée.');
    const produite = (await db.piecesJointes.get(rendue.pieceProduiteId!))!;
    expect(produite).toMatchObject({ nom: 'lettre-v2.pdf', nature: 'BROUILLON', version: 2 });
    const brouillons = await db.piecesJointes.where('[courrierId+nature]').equals(['sortant', 'BROUILLON']).toArray();
    expect(brouillons.sort((a, b) => b.version - a.version)[0].id).toBe(produite.id);
  });

  it('pour avis : un avis favorable ou défavorable motivé est exigé', async () => {
    await preparer();
    const tache = await confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'Votre avis ?', nature: 'POUR_AVIS' });

    await expect(rendreCompte(tache.id, assistante, { texte: 'Motif' })).rejects.toThrow('erreurs.avisObligatoire');
    await expect(rendreCompte(tache.id, assistante, { texte: ' ', avis: 'DEFAVORABLE' })).rejects.toThrow('erreurs.compteRenduObligatoire');
    await rendreCompte(tache.id, assistante, { texte: 'Montant hors budget', avis: 'DEFAVORABLE' });
    expect((await db.tachesConfiees.get(tache.id))?.avis).toBe('DEFAVORABLE');
  });

  it('pour information : un simple « vu » suffit', async () => {
    await preparer();
    const tache = await confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'Pour info', nature: 'POUR_INFORMATION' });
    await rendreCompte(tache.id, assistante, { texte: '' });
    expect((await db.tachesConfiees.get(tache.id))?.compteRendu).toBe('Vu.');
  });

  it('projet de réponse : le projet doit être rattaché, et le demandeur peut le soumettre', async () => {
    await preparer();
    const tache = await confierTache('circuit', dg, { posteDestinataireId: 'poste-assistante', note: 'Préparer la réponse', nature: 'PROJET_REPONSE' });
    await expect(rendreCompte(tache.id, assistante, { texte: '' })).rejects.toThrow('erreurs.projetReponseManquant');

    await db.courriers.bulkPut([
      { id: 'autre', sens: 'SORTANT', statut: 'BROUILLON', codeSuivi: 'X-1', reponseAId: 'ailleurs' } as unknown as Courrier,
      { id: 'projet', sens: 'SORTANT', statut: 'BROUILLON', codeSuivi: 'X-2', reponseAId: 'entrant', creeParId: 'nadege' } as unknown as Courrier,
    ]);
    await expect(attacherProjetReponse(tache.id, assistante, 'autre')).rejects.toThrow('erreurs.projetReponseInvalide');
    await expect(attacherProjetReponse(tache.id, dg, 'projet')).rejects.toThrow('erreurs.posteNonAssigne');
    await attacherProjetReponse(tache.id, assistante, 'projet');
    await rendreCompte(tache.id, assistante, { texte: '' });

    expect((await db.tachesConfiees.get(tache.id))).toMatchObject({ statut: 'RENDUE', sortantProduitId: 'projet', compteRendu: 'Projet de réponse préparé.' });
    expect(await peutSoumettreProjet('projet', 'poste-dg')).toBe(true);
    expect(await peutSoumettreProjet('projet', 'poste-assistante')).toBe(false);
  });
});
