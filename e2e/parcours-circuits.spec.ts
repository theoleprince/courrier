import { test, expect, type Page, type Locator } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * Parcours « jour de démo » : rejets, nouvelle version, et adaptation du
 * circuit en direct depuis l'administration (ajout, déplacement, suppression
 * d'étape, désactivation d'un circuit), plus la tâche confiée qui bloque la
 * signature. Chaque test part d'une base neuve (nouveau contexte navigateur).
 */

/* ------------------------------------------------------------------ */
/* Outils                                                               */
/* ------------------------------------------------------------------ */

async function connecter(page: Page, nomComplet: string) {
  await page.goto('/connexion');
  await page.getByRole('button', { name: nomComplet }).click();
  await expect(page).toHaveURL('/');
}

async function changerUtilisateur(page: Page, nomComplet: string) {
  await page.getByRole('button', { name: /Changer d'utilisateur/ }).click();
  await page.getByRole('button', { name: new RegExp(nomComplet) }).click();
}

/** Trace un trait dans le pad de la fenêtre ouverte. */
async function tracer(page: Page) {
  const zone = await page.getByRole('dialog').locator('canvas').boundingBox();
  expect(zone).toBeTruthy();
  const { x, y, width, height } = zone!;
  await page.mouse.move(x + width * 0.2, y + height * 0.6);
  await page.mouse.down();
  await page.mouse.move(x + width * 0.45, y + height * 0.3, { steps: 6 });
  await page.mouse.move(x + width * 0.7, y + height * 0.7, { steps: 6 });
  await page.mouse.up();
}

/** Trace un paraphe / une signature dans le pad de la fenêtre ouverte, puis confirme. */
async function tracerEtConfirmer(page: Page) {
  const modale = page.getByRole('dialog');
  const zone = await modale.locator('canvas').boundingBox();
  expect(zone).toBeTruthy();
  const { x, y, width, height } = zone!;
  await page.mouse.move(x + width * 0.2, y + height * 0.6);
  await page.mouse.down();
  await page.mouse.move(x + width * 0.45, y + height * 0.3, { steps: 6 });
  await page.mouse.move(x + width * 0.7, y + height * 0.7, { steps: 6 });
  await page.mouse.up();
  await modale.getByRole('button', { name: 'Signer', exact: true }).click();
  await expect(modale).toBeHidden();
}

/** Viser ou Valider : ouvre le pad de paraphe, trace, confirme. */
async function viserOuValider(page: Page, libelle: 'Viser' | 'Valider') {
  await page.getByRole('main').getByRole('button', { name: libelle, exact: true }).click();
  await tracerEtConfirmer(page);
}

async function rejeter(page: Page, motif: string) {
  await page.getByRole('main').getByRole('button', { name: 'Rejeter', exact: true }).click();
  const modale = page.getByRole('dialog');
  const bouton = modale.getByRole('button', { name: 'Rejeter', exact: true });
  await expect(bouton).toBeDisabled(); // motif obligatoire
  await modale.getByPlaceholder('Motif du rejet').fill(motif);
  await bouton.click();
  await expect(modale).toBeHidden();
}

async function choisirEntite(page: Page, libelle: string) {
  const zone = page.locator('main');
  const valeur = await zone.locator('select option', { hasText: libelle }).first().getAttribute('value');
  expect(valeur).toBeTruthy();
  await zone.locator('select').first().selectOption(valeur!);
}

async function enregistrerFacture(page: Page, objet: string): Promise<string> {
  await page.goto('/courriers/entrants/nouveau');
  await page.getByLabel('Objet').fill(objet);
  await page.getByRole('button', { name: 'Correspondant' }).click();
  await page.getByPlaceholder('Correspondant').fill('Bureautique');
  await page.getByRole('button', { name: 'Bureautique Plus', exact: true }).click();
  await page.getByLabel('Type').selectOption('FACTURE');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.getByRole('button', { name: 'Voir le détail complet' }).click();
  await expect(page).toHaveURL(/\/courriers\/[\w-]+$/);
  return page.url();
}

/** Imputation (SG) → traitement (chef comptabilité) → visa (DAF). */
async function amenerFactureAuVisa(page: Page, url: string) {
  await changerUtilisateur(page, 'Aïcha Bello');
  await page.goto(url);
  await choisirEntite(page, 'Service comptabilité');
  await page.getByRole('button', { name: 'Imputer', exact: true }).click();
  await expect(page.getByText('En cours de traitement par')).toBeVisible();

  await changerUtilisateur(page, 'Grâce Eyenga');
  await page.goto(url);
  await page.getByRole('button', { name: 'Marquer comme traité' }).click();
  await expect(page.getByText('En cours de validation')).toBeVisible();
}

async function pdfDeTest(titre: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  page.drawText(titre, { x: 60, y: 760, size: 18, font: await pdf.embedFont(StandardFonts.Helvetica) });
  return Buffer.from(await pdf.save());
}

function champsNom(page: Page): Locator {
  return page.getByLabel('Nom de l’étape').filter({ visible: true });
}

/** Carte d'une étape dans l'éditeur de circuits (repérée par son numéro d'ordre, 1 = première). */
function carteEtape(page: Page, numero: number): Locator {
  return champsNom(page).nth(numero - 1).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
}

async function ouvrirCircuit(page: Page, libelle: string) {
  await page.goto('/admin/circuits');
  await page.getByRole('tab', { name: libelle }).click();
}

async function nombreEtapes(page: Page): Promise<number> {
  return champsNom(page).count();
}

/** Ajoute en fin de circuit une étape confiée à un poste précis. */
async function ajouterEtapePoste(page: Page, nom: string, type: string, poste: RegExp) {
  await page.getByRole('button', { name: 'Ajouter une étape' }).filter({ visible: true }).click();
  const carte = carteEtape(page, await nombreEtapes(page));
  await carte.getByLabel('Nom de l’étape').fill(nom);
  await carte.locator('select').first().selectOption({ label: type });
  await carte.getByRole('button', { name: 'Un poste précis' }).click();
  const selectPoste = carte.locator('select').nth(1);
  const valeur = await selectPoste.locator('option', { hasText: poste }).first().getAttribute('value');
  await selectPoste.selectOption(valeur!);
  await carte.locator('input[type=number]').fill('1');
}

function boutonEnregistrer(page: Page): Locator {
  return page.getByRole('button', { name: 'Enregistrer', exact: true }).filter({ visible: true });
}

async function enregistrerCircuit(page: Page) {
  await boutonEnregistrer(page).click();
  await expect(page.getByText('Circuit enregistré')).toBeVisible();
}

/* ------------------------------------------------------------------ */
/* Parcours                                                             */
/* ------------------------------------------------------------------ */

test('sortant : visa, rejet du directeur, nouvelle version, resoumission, signature et expédition', async ({ page }) => {
  test.setTimeout(150_000);

  // Rodrigue (technicien) rédige et soumet.
  await connecter(page, 'Rodrigue Essomba');
  await page.goto('/courriers/sortants/nouveau');
  await page.getByRole('button', { name: 'Correspondant' }).click();
  await page.getByPlaceholder('Correspondant').fill('Transports');
  await page.getByRole('button', { name: 'Transports Nkolbisson SARL', exact: true }).click();
  const selectModele = page.locator('main select').filter({ has: page.locator('option', { hasText: 'Choisir un modèle' }) });
  await selectModele.selectOption({ index: 1 });
  await page.getByLabel('Objet').fill('Planning d’intervention — e2e');
  await page.getByRole('button', { name: 'Soumettre au circuit' }).last().click();
  await expect(page).toHaveURL(/\/courriers\/[\w-]+$/);
  const url = page.url();

  // Josiane (chef maintenance) vise.
  await changerUtilisateur(page, 'Josiane Atangana');
  await page.goto(url);
  await viserOuValider(page, 'Viser');

  // Hervé (directeur technique) rejette : motif obligatoire.
  await changerUtilisateur(page, 'Hervé Kamga');
  await page.goto(url);
  await rejeter(page, 'Préciser les dates d’intervention');

  // Rodrigue dépose une v2 et resoumet : le circuit repart du début.
  await changerUtilisateur(page, 'Rodrigue Essomba');
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Resoumettre' })).toBeVisible();
  await page.locator('main input[type=file][accept="application/pdf"]').setInputFiles({
    name: 'planning-v2.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfDeTest('Planning v2'),
  });
  await page.getByRole('button', { name: 'Resoumettre' }).click();

  await changerUtilisateur(page, 'Josiane Atangana');
  await page.goto(url);
  await viserOuValider(page, 'Viser');

  await changerUtilisateur(page, 'Hervé Kamga');
  await page.goto(url);
  await viserOuValider(page, 'Valider');

  // Paul (DG) signe depuis la fiche.
  await changerUtilisateur(page, 'Paul Mbarga');
  await page.goto(url);
  await page.getByRole('main').getByRole('button', { name: 'Signer', exact: true }).first().click();
  await tracerEtConfirmer(page);

  // Carine (bureau d'ordre) expédie par la poste.
  await changerUtilisateur(page, 'Carine Ngo Bassong');
  await page.goto(url);
  await page.locator('main select').filter({ has: page.locator('option', { hasText: 'Poste' }) }).first().selectOption('POSTE');
  await page.getByRole('main').getByRole('button', { name: 'Expédier', exact: true }).click();
  await expect(page.getByText(/DEP-\d{4}-\d+/).first()).toBeVisible();

  // Les versions successives restent consultables.
  const versions = page.locator('main select option');
  await expect(versions.filter({ hasText: 'planning-v2.pdf' }).first()).toBeAttached();
  expect(await versions.filter({ hasText: /v1\b/ }).count()).toBeGreaterThan(0);
});

test('circuit adapté en direct : étape ajoutée, courriers en cours inchangés, rejet sur la nouvelle étape', async ({ page }) => {
  test.setTimeout(180_000);

  // Facture A enregistrée AVANT la modification du circuit.
  await connecter(page, 'Carine Ngo Bassong');
  const urlA = await enregistrerFacture(page, 'Facture A — avant modification');

  // L'administrateur ajoute « Validation du DG » au circuit Facture fournisseur.
  await changerUtilisateur(page, 'Admin POC');
  await ouvrirCircuit(page, 'Facture fournisseur');
  expect(await nombreEtapes(page)).toBe(3);
  await ajouterEtapePoste(page, 'Validation du DG', 'Validation', /Directeur général/);
  await expect(page.getByText('Modifications non enregistrées')).toBeVisible();
  await enregistrerCircuit(page);
  await page.reload();
  await page.getByRole('tab', { name: 'Facture fournisseur' }).click();
  expect(await nombreEtapes(page)).toBe(4);

  // Facture B enregistrée APRÈS.
  await changerUtilisateur(page, 'Carine Ngo Bassong');
  const urlB = await enregistrerFacture(page, 'Facture B — après modification');

  // A garde son circuit d'origine : le visa du DAF la clôture.
  await amenerFactureAuVisa(page, urlA);
  await changerUtilisateur(page, 'Samuel Tchoupo');
  await page.goto(urlA);
  await viserOuValider(page, 'Viser');
  await expect(page.getByText(/Traité le/).first()).toBeVisible();

  // B passe par la nouvelle étape : après le visa, elle attend le DG.
  await amenerFactureAuVisa(page, urlB);
  await changerUtilisateur(page, 'Samuel Tchoupo');
  await page.goto(urlB);
  await viserOuValider(page, 'Viser');
  await expect(page.getByText(/Traité le/)).toHaveCount(0);

  await changerUtilisateur(page, 'Paul Mbarga');
  await page.goto('/corbeille');
  await expect(page.getByText('Facture B — après modification')).toBeVisible();

  // Le DG rejette sur la nouvelle étape : retour au traitement (comptabilité).
  await page.goto(urlB);
  await rejeter(page, 'Montant à vérifier avec le bon de commande');
  await expect(page.getByText('En cours de traitement par').first()).toBeVisible();

  await changerUtilisateur(page, 'Grâce Eyenga');
  await page.goto(urlB);
  await page.getByRole('button', { name: 'Marquer comme traité' }).click();
  await changerUtilisateur(page, 'Samuel Tchoupo');
  await page.goto(urlB);
  await viserOuValider(page, 'Viser');
  await changerUtilisateur(page, 'Paul Mbarga');
  await page.goto(urlB);
  await viserOuValider(page, 'Valider');
  await expect(page.getByText(/Traité le/).first()).toBeVisible();

  // Nettoyage démo : on retire l'étape, le circuit revient à 3 étapes.
  await changerUtilisateur(page, 'Admin POC');
  await ouvrirCircuit(page, 'Facture fournisseur');
  await carteEtape(page, 4).getByTitle('Supprimer l’étape').click();
  await enregistrerCircuit(page);
  expect(await nombreEtapes(page)).toBe(3);
});

test('éditeur de circuits : ordre modifiable et garde-fous à l’enregistrement', async ({ page }) => {
  await connecter(page, 'Admin POC');

  // Entrant : déplacer l'imputation hors de la 1re place est refusé.
  await ouvrirCircuit(page, 'Facture fournisseur');
  await carteEtape(page, 1).getByTitle('Descendre').click();
  await expect(champsNom(page).nth(1)).toHaveValue('Imputation');
  await boutonEnregistrer(page).click();
  await expect(page.getByText('Un circuit entrant doit commencer par une étape Imputation.')).toBeVisible();
  await carteEtape(page, 2).getByTitle('Monter').click();
  await expect(champsNom(page).first()).toHaveValue('Imputation');

  // Étape « poste précis » sans poste choisi : refusée.
  await page.getByRole('button', { name: 'Ajouter une étape' }).filter({ visible: true }).click();
  const nouvelle = carteEtape(page, await nombreEtapes(page));
  await nouvelle.getByLabel('Nom de l’étape').fill('Étape sans poste');
  await nouvelle.getByRole('button', { name: 'Un poste précis' }).click();
  await boutonEnregistrer(page).click();
  await expect(page.getByText('L\'étape « Étape sans poste » doit avoir un poste ou un rôle cible.')).toBeVisible();
  await nouvelle.getByTitle('Supprimer l’étape').click();

  // Sortant : supprimer la signature est refusé.
  await ouvrirCircuit(page, 'Sortant standard');
  const indexSignature = (await champsNom(page).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).indexOf('Signature du DG');
  expect(indexSignature).toBeGreaterThanOrEqual(0);
  await carteEtape(page, indexSignature + 1).getByTitle('Supprimer l’étape').click();
  await boutonEnregistrer(page).click();
  await expect(page.getByText('Un circuit sortant doit contenir une étape Signature.')).toBeVisible();
});

test('circuit désactivé : la facture suit le circuit « Entrant standard »', async ({ page }) => {
  await connecter(page, 'Admin POC');
  await ouvrirCircuit(page, 'Facture fournisseur');
  // Case pilotée par la base (mise à jour asynchrone) : clic puis attente de l'état.
  const caseActif = page.getByLabel('Circuit actif').filter({ visible: true });
  await caseActif.click();
  await expect(caseActif).not.toBeChecked();
  await expect(page.getByRole('tab', { name: 'Facture fournisseur (désactivé)' })).toBeVisible();

  await changerUtilisateur(page, 'Carine Ngo Bassong');
  const url = await enregistrerFacture(page, 'Facture — circuit désactivé');

  await changerUtilisateur(page, 'Aïcha Bello');
  await page.goto(url);
  await choisirEntite(page, 'Service comptabilité');
  await page.getByRole('button', { name: 'Imputer', exact: true }).click();

  // Étapes du circuit standard (pas de « Contrôle comptable » ni de « Visa du DAF »).
  const main = page.getByRole('main');
  await expect(main.getByText('Validation du directeur').first()).toBeVisible();
  await expect(main.getByText('Visa du DAF')).toHaveCount(0);
  await expect(main.getByText('Contrôle comptable')).toHaveCount(0);
});

test('tâche confiée : la signature est bloquée jusqu’au compte rendu', async ({ page }) => {
  await connecter(page, 'Paul Mbarga');
  await page.goto('/parapheur');
  await page.getByRole('button', { name: 'Ouvrir', exact: true }).first().click();
  await expect(page).toHaveURL(/\/courriers\/[\w-]+$/);
  const url = page.url();

  await page.getByRole('button', { name: /Confier à/ }).click();
  const modale = page.getByRole('dialog');
  const select = modale.locator('select');
  await select.selectOption((await select.locator('option', { hasText: 'Assistante de direction' }).getAttribute('value'))!);
  await modale.locator('textarea').fill('Vérifier les pièces avant signature');
  await modale.getByRole('button', { name: /Confier à/ }).click();
  await expect(page.getByText('En attente du compte rendu')).toBeVisible();

  // Tentative de signature : refusée tant que la tâche est ouverte.
  await page.getByRole('main').getByRole('button', { name: 'Signer', exact: true }).first().click();
  await tracer(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Signer', exact: true }).click();
  await expect(page.getByText(/attend son compte rendu/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();

  await changerUtilisateur(page, 'Nadège Owona');
  await page.goto(url);
  await page.getByPlaceholder('Votre compte rendu').fill('Pièces vérifiées, conforme.');
  await page.getByRole('button', { name: 'Rendre compte' }).click();

  await changerUtilisateur(page, 'Paul Mbarga');
  await page.goto(url);
  await expect(page.getByText('Compte rendu reçu')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Signer', exact: true }).first().click();
  await tracerEtConfirmer(page);
  await expect(page.getByText(/Signé|À expédier|Expédition/).first()).toBeVisible();
});

async function rediger(page: Page, objet: string): Promise<string> {
  await page.goto('/courriers/sortants/nouveau');
  await page.getByRole('button', { name: 'Correspondant' }).click();
  await page.getByPlaceholder('Correspondant').fill('Transports');
  await page.getByRole('button', { name: 'Transports Nkolbisson SARL', exact: true }).click();
  const selectModele = page.locator('main select').filter({ has: page.locator('option', { hasText: 'Choisir un modèle' }) });
  await selectModele.selectOption({ index: 1 });
  await page.getByLabel('Objet').fill(objet);
  await page.getByRole('button', { name: 'Soumettre au circuit' }).last().click();
  await expect(page).toHaveURL(/\/courriers\/[\w-]+$/);
  return page.url();
}

test('circuit sortant adapté : visa du DAF inséré avant la signature, puis rejet du DG et resoumission', async ({ page }) => {
  test.setTimeout(180_000);
  await connecter(page, 'Admin POC');
  await ouvrirCircuit(page, 'Sortant standard');
  await ajouterEtapePoste(page, 'Visa du DAF', 'Visa', /Directeur administratif et financier/);
  // Remonter la nouvelle étape (5e) avant « Signature du DG » (3e) et « Expédition » (4e).
  await carteEtape(page, 5).getByTitle('Monter').click();
  await carteEtape(page, 4).getByTitle('Monter').click();
  await expect(champsNom(page).nth(2)).toHaveValue('Visa du DAF');
  await enregistrerCircuit(page);

  await changerUtilisateur(page, 'Rodrigue Essomba');
  const url = await rediger(page, 'Demande de devis — circuit adapté');
  await changerUtilisateur(page, 'Josiane Atangana');
  await page.goto(url);
  await viserOuValider(page, 'Viser');
  await changerUtilisateur(page, 'Hervé Kamga');
  await page.goto(url);
  await viserOuValider(page, 'Valider');

  // Nouvelle étape : le DAF vise avant le DG.
  await changerUtilisateur(page, 'Samuel Tchoupo');
  await page.goto('/corbeille');
  await expect(page.getByText('Demande de devis — circuit adapté')).toBeVisible();
  await page.goto(url);
  await viserOuValider(page, 'Viser');

  // Le DG rejette au parapheur : le sortant revient au rédacteur.
  await changerUtilisateur(page, 'Paul Mbarga');
  await page.goto(url);
  await rejeter(page, 'Revoir le montant plafond');
  await changerUtilisateur(page, 'Rodrigue Essomba');
  await page.goto(url);
  await page.getByRole('button', { name: 'Resoumettre' }).click();
  // Le circuit repart du début : visa du chef de service.
  await changerUtilisateur(page, 'Josiane Atangana');
  await page.goto('/corbeille');
  await expect(page.getByText('Demande de devis — circuit adapté')).toBeVisible();
});

test('changer la cible d’une étape : le visa de la facture passe au Secrétaire général', async ({ page }) => {
  test.setTimeout(150_000);
  await connecter(page, 'Admin POC');
  await ouvrirCircuit(page, 'Facture fournisseur');
  const visa = carteEtape(page, 3);
  await expect(visa.getByLabel('Nom de l’étape')).toHaveValue('Visa du DAF');
  await visa.getByLabel('Nom de l’étape').fill('Visa du SG');
  const selectPoste = visa.locator('select').nth(1);
  await selectPoste.selectOption((await selectPoste.locator('option', { hasText: /Secrétaire général/ }).first().getAttribute('value'))!);
  await enregistrerCircuit(page);

  await changerUtilisateur(page, 'Carine Ngo Bassong');
  const url = await enregistrerFacture(page, 'Facture — visa SG');
  await amenerFactureAuVisa(page, url);
  await changerUtilisateur(page, 'Aïcha Bello');
  await page.goto(url);
  await viserOuValider(page, 'Viser');
  await expect(page.getByText(/Traité le/).first()).toBeVisible();
});

test('règles de l’éditeur : pas de signature dans un circuit entrant', async ({ page }) => {
  await connecter(page, 'Admin POC');
  await ouvrirCircuit(page, 'Facture fournisseur');
  await ajouterEtapePoste(page, 'Signature du DG', 'Signature', /Directeur général/);
  await boutonEnregistrer(page).click();
  await expect(page.getByText(/Un circuit entrant ne peut pas contenir d’étape Signature/)).toBeVisible();
});

test('plus aucun circuit entrant actif : message clair à l’enregistrement', async ({ page }) => {
  await connecter(page, 'Admin POC');
  for (const libelle of ['Facture fournisseur', 'Entrant standard']) {
    await ouvrirCircuit(page, libelle);
    const caseActif = page.getByLabel('Circuit actif').filter({ visible: true });
    await caseActif.click();
    await expect(caseActif).not.toBeChecked();
  }
  await changerUtilisateur(page, 'Carine Ngo Bassong');
  await page.goto('/courriers/entrants/nouveau');
  await page.getByLabel('Objet').fill('Facture sans circuit');
  await page.getByRole('button', { name: 'Correspondant' }).click();
  await page.getByPlaceholder('Correspondant').fill('Bureautique');
  await page.getByRole('button', { name: 'Bureautique Plus', exact: true }).click();
  await page.getByLabel('Type').selectOption('FACTURE');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText(/Aucun circuit actif pour ce type de courrier/)).toBeVisible();
});
