import { test, expect } from '@playwright/test';

/**
 * Scénario D (section 19 des spécifications) : l'accueil retrouve un courrier
 * en tapant un nom, lit le statut en langage clair, puis le même dossier est
 * consultable sur le portail public avec le code de suivi + 3 lettres du nom.
 * S'appuie sur le courrier « de scène » de M. Abena (code fixe ABEN-2345,
 * section 15.4), toujours dans le même état après réinitialisation.
 */
test('accueil : recherche, fiche de suivi et portail usager', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Mireille Ondoa' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/recherche');
  // Scopé à <main> : l'en-tête a aussi un champ de recherche.
  await page.getByRole('main').getByPlaceholder('Rechercher…', { exact: true }).fill('abena');
  await expect(page.getByText(/ABEN-2345|Demande de duplicata/)).toBeVisible();

  await page.goto('/suivi/ABEN-2345');
  await expect(page.getByText(/En cours de traitement par/)).toBeVisible();

  await page.goto('/portail');
  await page.getByPlaceholder('XXXX-XXXX').fill('ABEN-2345');
  await page.locator('input').nth(1).fill('Abe');
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page.getByText('ARR-2026-000014')).toBeVisible();
  await expect(page.getByText(/En cours de traitement par/)).toBeVisible();
});

test('un courrier confidentiel masque son objet pour l’accueil', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Mireille Ondoa' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/courriers/entrants');
  await expect(page.getByText('Courrier confidentiel').first()).toBeVisible();
});
