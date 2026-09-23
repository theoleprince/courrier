import { test, expect, type Page } from '@playwright/test';

/**
 * Scénario A (section 19) : un entrant est enregistré, imputé, traité, rejeté
 * une fois par le viseur (motif obligatoire), retraité, puis visé — le
 * courrier se clôture. Exercise le moteur de circuit de bout en bout
 * (imputation, saut n'ayant pas lieu ici, rejet avec réinitialisation de
 * l'étape de traitement, clôture) via l'interface, en changeant d'acteur
 * avec la bascule rapide d'utilisateur de la barre de démo.
 */

async function changerUtilisateur(page: Page, nomComplet: string) {
  // Le bouton de bascule inclut les initiales de l'avatar dans son nom accessible
  // (ex. « AB Aïcha Bello ») : correspondance partielle, pas exacte.
  await page.getByRole('button', { name: /Changer d'utilisateur/ }).click();
  await page.getByRole('button', { name: nomComplet }).click();
}

async function choisirEntiteParLibelle(page: Page, libelle: string) {
  // Scopé à <main> : l'en-tête contient aussi des <select> (langue, poste actif).
  const zone = page.locator('main');
  const valeur = await zone.locator('select option', { hasText: libelle }).first().getAttribute('value');
  expect(valeur).toBeTruthy();
  await zone.locator('select').first().selectOption(valeur!);
}

test('scénario A : circulation avec rejet puis clôture', async ({ page }) => {
  // 1) Carine (bureau d'ordre) enregistre une facture de Bureautique Plus.
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Carine Ngo Bassong' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/courriers/entrants/nouveau');
  await page.getByLabel('Objet').fill('Facture e2e — scénario A');
  await page.getByRole('button', { name: 'Correspondant' }).click();
  await page.getByPlaceholder('Correspondant').fill('Bureautique');
  await page.getByRole('button', { name: 'Bureautique Plus', exact: true }).click();
  await page.getByLabel('Type').selectOption('FACTURE');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

  await expect(page.getByRole('heading', { name: /enregistré/ })).toBeVisible();
  await page.getByRole('button', { name: 'Voir le détail complet' }).click();
  await expect(page).toHaveURL(/\/courriers\/[\w-]+$/);
  const urlCourrier = page.url();

  // 2) Aïcha (secrétaire générale) impute au Service comptabilité.
  await changerUtilisateur(page, 'Aïcha Bello');
  await page.goto(urlCourrier);
  await choisirEntiteParLibelle(page, 'Service comptabilité');
  await page.getByRole('button', { name: 'Imputer', exact: true }).click();
  await expect(page.getByText('En cours de traitement par')).toBeVisible();

  // 3) Grâce (chef comptabilité) traite.
  await changerUtilisateur(page, 'Grâce Eyenga');
  await page.goto(urlCourrier);
  await page.getByRole('button', { name: 'Marquer comme traité' }).click();
  await expect(page.getByText('En cours de validation')).toBeVisible();

  // 4) Samuel (DAF) rejette avec un motif — retour chez Grâce.
  await changerUtilisateur(page, 'Samuel Tchoupo');
  await page.goto(urlCourrier);
  await page.getByRole('button', { name: 'Rejeter', exact: true }).click();
  const modaleRejet = page.getByRole('dialog');
  await modaleRejet.getByPlaceholder('Motif du rejet').fill('Pièce justificative manquante');
  await modaleRejet.getByRole('button', { name: 'Rejeter', exact: true }).click();
  await expect(page.getByText('En cours de traitement par')).toBeVisible();

  // 5) Grâce retraite, Samuel vise → clôture.
  await changerUtilisateur(page, 'Grâce Eyenga');
  await page.goto(urlCourrier);
  await page.getByRole('button', { name: 'Marquer comme traité' }).click();

  await changerUtilisateur(page, 'Samuel Tchoupo');
  await page.goto(urlCourrier);
  await page.getByRole('button', { name: 'Viser', exact: true }).click();
  await expect(page.getByText(/Traité le/)).toBeVisible();

  // Verdict final : issue, dernière décision avec son auteur, rejet intermédiaire compté.
  const verdict = page.getByRole('region', { name: 'Verdict final' });
  await expect(verdict).toBeVisible();
  await expect(verdict.getByText('Traité et clôturé')).toBeVisible();
  await expect(verdict.getByText(/Visé · Visa du DAF par/)).toBeVisible();
  await expect(verdict.getByText('Samuel Tchoupo')).toBeVisible();
  await expect(verdict.getByText('1 rejet en cours de route')).toBeVisible();
});
