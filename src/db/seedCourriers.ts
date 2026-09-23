import { PDFDocument, StandardFonts } from 'pdf-lib';
import { embarquerPolice } from '@/services/polices';
import { db } from '@/db/db';
import { decaler, revenirAuPresent, maintenantISO, ajouterJours } from '@/services/horloge';
import { verifierEcheances } from '@/services/notifications';
import { enregistrerEntrant, creerSortant, validerEtape, signer, expedier } from '@/services/workflow';
import type { Acteur, ID, TypeEtape } from '@/types/models';

async function acteurDe(nomComplet: string): Promise<Acteur> {
  const personnes = await db.personnes.toArray();
  const personne = personnes.find((p) => `${p.prenom} ${p.nom}` === nomComplet);
  if (!personne?.posteId) throw new Error(`Personne introuvable pour le seed : ${nomComplet}`);
  return { personneId: personne.id, posteId: personne.posteId };
}

/** Résout l'acteur au titulaire d'un poste donné (utilisé pour dérouler un circuit automatiquement). */
async function acteurDuPoste(posteId: ID): Promise<Acteur> {
  const personne = (await db.personnes.toArray()).find((p) => p.posteId === posteId && p.actif);
  if (!personne) throw new Error(`Aucun titulaire actif pour le poste ${posteId}`);
  return { personneId: personne.id, posteId };
}

async function correspondantDe(nom: string): Promise<ID> {
  const trouve = (await db.correspondants.toArray()).find((c) => c.nom === nom);
  if (!trouve) throw new Error(`Correspondant introuvable pour le seed : ${nom}`);
  return trouve.id;
}

async function entiteDe(libelle: string): Promise<ID> {
  const trouve = (await db.entites.toArray()).find((e) => e.libelle === libelle);
  if (!trouve) throw new Error(`Entité introuvable pour le seed : ${libelle}`);
  return trouve.id;
}

/**
 * Déroule un circuit automatiquement : résout à chaque étape le titulaire du
 * poste assigné et valide en son nom, jusqu'à ce que le circuit se termine ou
 * qu'une étape de type `arreterAvant` soit atteinte (SIGNATURE/EXPEDITION par
 * défaut, gérées séparément par le seed). Sert à peupler un historique
 * réaliste sans avoir à retracer manuellement les sauts automatiques
 * (règle 8.2.5) pour chaque combinaison entité / circuit.
 */
async function avancerCircuit(
  circuitId: ID,
  entiteTraitanteId?: ID,
  arreterAvant: TypeEtape[] = ['SIGNATURE', 'EXPEDITION'],
): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const circuit = await db.circuits.get(circuitId);
    if (!circuit || circuit.statut !== 'EN_COURS') return;
    const etape = circuit.etapes[circuit.indexCourant];
    if (!etape || arreterAvant.includes(etape.type) || !etape.posteAssigneId) return;
    const acteur = await acteurDuPoste(etape.posteAssigneId);
    await validerEtape(circuitId, acteur, etape.type === 'IMPUTATION' ? { entiteTraitanteId } : {});
  }
}

const IMAGE_SIGNATURE_SEED =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** Petit PDF réel (une page, l'objet en texte) : pdf-lib refuse un Blob PDF factice non structuré. */
async function pdfPlaceholder(objet: string): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]);
  const police = await embarquerPolice(pdf, StandardFonts.Helvetica);
  page.drawText(objet, { x: 40, y: 520, size: 12, font: police, maxWidth: 340, lineHeight: 16 });
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/** Pièce « scannée » d'un entrant de démonstration, pour que la fiche détail ait un document à afficher. */
async function scanDe(objet: string) {
  return { blob: await pdfPlaceholder(objet), nom: 'scan.pdf', mime: 'application/pdf' };
}

export async function dejaInitialisee(): Promise<boolean> {
  return (await db.courriers.count()) > 0;
}

/**
 * Historique de démonstration (section 15.4). Version réduite par rapport aux
 * ~60 courriers de la spécification, compte tenu du temps disponible pour ce
 * POC : une quinzaine de dossiers couvrant chaque statut clé, plus les trois
 * courriers « de scène » toujours dans le même état. Voir DECISIONS.md.
 */
export async function seedCourriers(): Promise<void> {
  if (await dejaInitialisee()) return;

  const carine = await acteurDe('Carine Ngo Bassong');
  const idriss = await acteurDe('Idriss Moussa');
  const samuel = await acteurDe('Samuel Tchoupo');
  const paul = await acteurDe('Paul Mbarga');

  const cpt = await entiteDe('Service comptabilité');
  const rh = await entiteDe('Service ressources humaines');
  const mnt = await entiteDe('Service maintenance');
  const daf = await entiteDe('Direction administrative et financière');

  const banque = await correspondantDe('Banque Atlantique Centrale');
  const transports = await correspondantDe('Transports Nkolbisson SARL');
  const cabinetEkambi = await correspondantDe('Cabinet Ekambi & Associés');
  const bureautique = await correspondantDe('Bureautique Plus');
  const mairie = await correspondantDe('Mairie d’arrondissement');
  const abena = await correspondantDe('Jean-Claude Abena');
  const hamadou = await correspondantDe('Fadimatou Hamadou');
  const assurances = await correspondantDe('Société d’Assurances du Littoral');

  async function avancerHorloge(jours: number) {
    await decaler(jours * 24 * 60);
  }

  // --- Historique : on démarre 55 jours dans le passé ---------------------
  await avancerHorloge(-55);

  // 1) Facture clôturée sans réponse
  {
    const c = await enregistrerEntrant(
      { objet: 'Facture n°2201 — fournitures de bureau', type: 'FACTURE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: bureautique, modeDepot: 'GUICHET', reponseAttendue: false },
      await scanDe('Facture n°2201 — fournitures de bureau'),
      carine,
    );
    await avancerCircuit(c.circuitInstanceId!, cpt);
  }
  await avancerHorloge(3);

  // 2) Réponse à une lettre de la banque, signée et expédiée
  {
    const entrant = await enregistrerEntrant(
      { objet: 'Mise à jour des conditions du compte professionnel', type: 'LETTRE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: banque, modeDepot: 'POSTE', reponseAttendue: true },
      await scanDe('Mise à jour des conditions du compte professionnel'),
      carine,
    );
    await avancerCircuit(entrant.circuitInstanceId!, daf);
    await avancerHorloge(1);

    const modele = (await db.modelesLettre.toArray()).find((m) => m.libelle === 'Réponse favorable');
    const sortant = await creerSortant(
      { objet: 'Réponse — conditions du compte', type: 'LETTRE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: banque, reponseAId: entrant.id, modeleLettreId: modele?.id },
      { blob: await pdfPlaceholder('Réponse — conditions du compte'), nom: 'reponse-banque.pdf', mime: 'application/pdf' },
      samuel,
    );
    await avancerCircuit(sortant.circuitInstanceId!);
    await avancerHorloge(1);
    if (sortant.circuitInstanceId) {
      await signer(sortant.circuitInstanceId, paul, { imagePngDataUrl: IMAGE_SIGNATURE_SEED, origineUrl: 'https://poc.local' });
    }
    await avancerHorloge(1);
    await expedier(sortant.id, carine, { modeEnvoi: 'EMAIL', accuseReception: true });
  }
  await avancerHorloge(4);

  // 3) Demande RH clôturée
  {
    const c = await enregistrerEntrant(
      { objet: 'Demande de stage — suivi', type: 'DEMANDE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: mairie, modeDepot: 'POSTE', reponseAttendue: false },
      await scanDe('Demande de stage — suivi'),
      carine,
    );
    await avancerCircuit(c.circuitInstanceId!, rh);
  }
  await avancerHorloge(5);

  // 4) Goulot sur la Direction technique : deux dossiers bloqués en « Validation du directeur »
  for (const objet of ['Rapport d’incident — panne groupe électrogène', 'Demande de rénovation atelier']) {
    const c = await enregistrerEntrant(
      { objet, type: 'NOTE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: transports, modeDepot: 'GUICHET', reponseAttendue: false },
      await scanDe(objet),
      carine,
    );
    // Entité traitante = Service maintenance (sous la Direction technique) : le
    // "Traitement" est fait par le chef de service, la "Validation du directeur"
    // par le directeur technique ; postes distincts, donc pas de saut automatique.
    await avancerCircuit(c.circuitInstanceId!, mnt, ['VALIDATION']);
  }
  await avancerHorloge(18);

  // 5) Deux entrants jamais traités (retard important dès l'imputation)
  for (const [objet, correspondantId] of [
    ['Demande de résiliation de contrat', assurances],
    ['Réclamation facturation double', bureautique],
  ] as const) {
    await enregistrerEntrant(
      { objet, type: 'RECLAMATION', priorite: 'URGENTE', confidentialite: 'INTERNE', correspondantId, modeDepot: 'EMAIL', reponseAttendue: false },
      await scanDe(objet),
      carine,
    );
  }
  await avancerHorloge(2);

  // 6) Deux confidentiels, imputés puis laissés en cours
  for (const [objet, correspondantId] of [
    ['Dossier disciplinaire — confidentiel', hamadou],
    ['Négociation contractuelle — confidentiel', cabinetEkambi],
  ] as const) {
    const c = await enregistrerEntrant(
      { objet, type: 'AUTRE', priorite: 'NORMALE', confidentialite: 'CONFIDENTIEL', correspondantId, modeDepot: 'GUICHET', reponseAttendue: false },
      await scanDe(objet),
      carine,
    );
    await validerEtape(c.circuitInstanceId!, await acteurDe('Aïcha Bello'), { entiteTraitanteId: daf });
  }
  await avancerHorloge(2);

  // 7) Trois sortants en attente de signature du DG (pour la signature en lot)
  for (const objet of ['Note de service — congés annuels', 'Courrier de félicitations', 'Transmission de dossier technique']) {
    const sortant = await creerSortant(
      { objet, type: 'NOTE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: mairie },
      { blob: await pdfPlaceholder(objet), nom: 'note.pdf', mime: 'application/pdf' },
      samuel,
    );
    if (sortant.circuitInstanceId) await avancerCircuit(sortant.circuitInstanceId);
  }
  await avancerHorloge(1);

  // 8) Deux sortants signés, prêts à expédier
  for (const objet of ['Confirmation de rendez-vous', 'Bordereau d’envoi de pièces']) {
    const sortant = await creerSortant(
      { objet, type: 'LETTRE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: cabinetEkambi },
      { blob: await pdfPlaceholder(objet), nom: 'lettre.pdf', mime: 'application/pdf' },
      idriss,
    );
    if (sortant.circuitInstanceId) {
      await avancerCircuit(sortant.circuitInstanceId);
      await signer(sortant.circuitInstanceId, paul, { imagePngDataUrl: IMAGE_SIGNATURE_SEED, origineUrl: 'https://poc.local' });
    }
  }

  // --- Retour au présent ---------------------------------------------------
  await revenirAuPresent();

  // 9) Réponses attendues « aujourd'hui » : trois dans les délais, une hors délai
  for (const [objet, correspondantId, joursLimite] of [
    ['Demande de réduction tarifaire', transports, 10],
    ['Question sur facture de maintenance', bureautique, 7],
    ['Demande d’attestation', hamadou, 4],
    ['Réclamation qualité de service', assurances, -5],
  ] as const) {
    const dateLimiteReponse = ajouterJours(maintenantISO(), joursLimite);
    const c = await enregistrerEntrant(
      { objet, type: 'DEMANDE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId, modeDepot: 'GUICHET', reponseAttendue: true, dateLimiteReponse },
      await scanDe(objet),
      carine,
    );
    await avancerCircuit(c.circuitInstanceId!, cpt);
  }

  // 10) Trois courriers « de scène » (section 15.4), toujours dans le même état
  {
    // Lettre de M. Abena déposée « hier », en traitement à la DAF, code fixe.
    await avancerHorloge(-1);
    const c = await enregistrerEntrant(
      { objet: 'Demande de duplicata d’attestation', type: 'DEMANDE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: abena, modeDepot: 'GUICHET', deposant: { nom: 'Jean-Claude Abena' }, reponseAttendue: false },
      await scanDe('Demande de duplicata d’attestation'),
      carine,
    );
    await revenirAuPresent();
    await validerEtape(c.circuitInstanceId!, await acteurDe('Aïcha Bello'), { entiteTraitanteId: daf });
    await db.courriers.update(c.id, { codeSuivi: 'ABEN-2345' });
  }
  {
    // Convocation du Cabinet Ekambi, urgente, encore à imputer.
    await enregistrerEntrant(
      { objet: 'Convocation — audience du 14', type: 'CONVOCATION', priorite: 'TRES_URGENTE', confidentialite: 'INTERNE', correspondantId: cabinetEkambi, modeDepot: 'COURSIER', reponseAttendue: false },
      await scanDe('Convocation — audience du 14'),
      carine,
    );
  }
  {
    // Réponse à la Banque Atlantique Centrale, en attente de la signature du DG.
    const sortant = await creerSortant(
      { objet: 'Réponse — demande de virement', type: 'LETTRE', priorite: 'NORMALE', confidentialite: 'INTERNE', correspondantId: banque },
      { blob: await pdfPlaceholder('Réponse — demande de virement'), nom: 'reponse-banque-scene.pdf', mime: 'application/pdf' },
      samuel,
    );
    if (sortant.circuitInstanceId) await avancerCircuit(sortant.circuitInstanceId);
  }

  await verifierEcheances();
}
