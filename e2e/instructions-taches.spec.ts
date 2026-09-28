import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * Tâches confiées avec instruction (annotation en marge) : chaque instruction
 * donne au destinataire les actions attendues, et le demandeur retrouve le
 * résultat sous sa note.
 */

async function connecter(page: Page, nomComplet: string) {
  await page.goto('/connexion');
  await page.getByRole('button', { name: nomComplet }).click();
  await expect(page).toHaveURL('/');
}

async function changerUtilisateur(page: Page, nomComplet: string) {
  await page.getByRole('button', { name: /Changer d'utilisateur/ }).click();
  await page.getByRole('button', { name: new RegExp(nomComplet) }).click();
}

async function tracerEtConfirmer(page: Page) {
  const modale = page.getByRole('dialog');
  const zone = (await modale.locator('canvas').boundingBox())!;
  await page.mouse.move(zone.x + zone.width * 0.2, zone.y + zone.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(zone.x + zone.width * 0.5, zone.y + zone.height * 0.3, { steps: 6 });
  await page.mouse.move(zone.x + zone.width * 0.8, zone.y + zone.height * 0.7, { steps: 6 });
  await page.mouse.up();
  await modale.getByRole('button', { name: 'Signer', exact: true }).click();
  await expect(modale).toBeHidden();
}

/** Depuis la fiche ouverte : « Confier à… » avec un poste, une instruction et une note. */
async function confier(page: Page, poste: string, instruction: string, note: string) {
  await page.getByRole('button', { name: /Confier à/ }).click();
  const modale = page.getByRole('dialog');
  const selectPoste = modale.locator('select').first();
  await selectPoste.selectOption((await selectPoste.locator('option', { hasText: poste }).first().getAttribute('value'))!);
  await modale.getByLabel('Instruction').selectOption({ label: instruction });
  await modale.locator('textarea').fill(note);
  await modale.getByRole('button', { name: /Confier à/ }).click();
  await expect(modale).toBeHidden();
}

/** Ouvre, depuis la corbeille, la tâche confiée portant cette note. */
async function ouvrirTacheConfiee(page: Page, note: string) {
  await page.goto('/corbeille');
  await page.getByText(note).click();
  await expect(page).toHaveURL(/\/courriers\/[\w-]+$/);
}

async function ouvrirDepuisParapheur(page: Page): Promise<string> {
  await page.goto('/parapheur');
  await page.getByRole('button', { name: 'Ouvrir', exact: true }).first().click();
  await expect(page).toHaveURL(/\/courriers\/[\w-]+$/);
  return page.url();
}

async function pdf(titre: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawText(titre, { x: 60, y: 760, size: 18, font: await doc.embedFont(StandardFonts.Helvetica) });
  return Buffer.from(await doc.save());
}

test('corriger le document : l’assistante dépose une version corrigée, le DG la signe', async ({ page }) => {
  await connecter(page, 'Paul Mbarga');
  const url = await ouvrirDepuisParapheur(page);
  await confier(page, 'Assistante de direction', 'Corriger le document', 'Corriger la date en en-tête');

  await changerUtilisateur(page, 'Nadège Owona');
  await ouvrirTacheConfiee(page, 'Corriger la date en en-tête');
  await expect(page.getByText('Corriger le document').first()).toBeVisible();
  const rendre = page.getByRole('button', { name: 'Rendre compte' });
  await expect(rendre).toBeDisabled(); // la version corrigée est exigée
  await page.locator('main input[type=file][accept="application/pdf"]').last().setInputFiles({
    name: 'lettre-corrigee.pdf',
    mimeType: 'application/pdf',
    buffer: await pdf('Version corrigée'),
  });
  await rendre.click();

  await changerUtilisateur(page, 'Paul Mbarga');
  await page.goto(url);
  await expect(page.getByText(/Version corrigée : lettre-corrigee\.pdf/)).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Signer', exact: true }).first().click();
  await tracerEtConfirmer(page);
  // La version signée est issue de la version corrigée.
  await expect(page.locator('main select option', { hasText: 'lettre-corrigee-signe.pdf' }).first()).toBeAttached();
});

test('projet de réponse : l’assistante le rédige, la SG le retrouve et le soumet au circuit', async ({ page }) => {
  test.setTimeout(120_000);
  await connecter(page, 'Carine Ngo Bassong');
  await page.goto('/courriers/entrants/nouveau');
  await page.getByLabel('Objet').fill('Demande de partenariat — e2e');
  await page.getByRole('button', { name: 'Correspondant' }).click();
  await page.getByPlaceholder('Correspondant').fill('Banque');
  await page.getByRole('button', { name: 'Banque Atlantique Centrale', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.getByRole('button', { name: 'Voir le détail complet' }).click();
  const url = page.url();

  await changerUtilisateur(page, 'Aïcha Bello');
  await page.goto(url);
  await confier(page, 'Assistante de direction', 'Préparer un projet de réponse', 'Préparer une réponse favorable');

  await changerUtilisateur(page, 'Nadège Owona');
  await ouvrirTacheConfiee(page, 'Préparer une réponse favorable');
  await expect(page.getByRole('button', { name: 'Rendre compte' })).toBeDisabled(); // pas encore de projet
  await page.getByRole('button', { name: 'Rédiger le projet de réponse' }).click();
  await expect(page).toHaveURL(/tache=/);
  const selectModele = page.locator('main select').filter({ has: page.locator('option', { hasText: 'Choisir un modèle' }) });
  await selectModele.selectOption({ index: 1 });
  await expect(page.getByRole('button', { name: 'Soumettre au circuit' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Enregistrer le projet de réponse' }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole('button', { name: /Projet de réponse :/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Rendre compte' }).click();

  await changerUtilisateur(page, 'Aïcha Bello');
  await page.goto(url);
  await page.getByRole('button', { name: /Projet de réponse :/ }).first().click();
  await expect(page.getByText('Brouillon à soumettre')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Soumettre au circuit' }).click();
  await expect(page.getByText('Brouillon à soumettre')).toHaveCount(0);
});

test('pour avis : la SG donne un avis défavorable motivé, le DG le voit', async ({ page }) => {
  await connecter(page, 'Paul Mbarga');
  const url = await ouvrirDepuisParapheur(page);
  await confier(page, 'Secrétaire général', 'Pour avis', 'Ce courrier peut-il partir en l’état ?');

  await changerUtilisateur(page, 'Aïcha Bello');
  await ouvrirTacheConfiee(page, 'Ce courrier peut-il partir en l’état ?');
  const donner = page.getByRole('button', { name: 'Donner l’avis' }).or(page.getByRole('button', { name: "Donner l'avis" }));
  await expect(donner).toBeDisabled();
  await page.getByRole('radio', { name: /Avis défavorable/ }).click();
  await page.getByPlaceholder('Motivez votre avis').fill('Il manque la référence du contrat.');
  await donner.click();

  await changerUtilisateur(page, 'Paul Mbarga');
  await page.goto(url);
  await expect(page.getByText('Avis défavorable').first()).toBeVisible();
  await expect(page.getByText('Il manque la référence du contrat.')).toBeVisible();
});

test('pour information : un clic sur « Vu » suffit', async ({ page }) => {
  await connecter(page, 'Paul Mbarga');
  const url = await ouvrirDepuisParapheur(page);
  await confier(page, 'Assistante de direction', 'Pour information', 'Pour votre information');

  await changerUtilisateur(page, 'Nadège Owona');
  await ouvrirTacheConfiee(page, 'Pour votre information');
  await page.getByRole('button', { name: 'Vu', exact: true }).click();
  await page.goto('/corbeille');
  await expect(page.getByText('Pour votre information')).toHaveCount(0);

  await changerUtilisateur(page, 'Paul Mbarga');
  await page.goto(url);
  await expect(page.getByText('Compte rendu reçu')).toBeVisible();
  await expect(page.getByText('Vu.', { exact: true })).toBeVisible();
});
