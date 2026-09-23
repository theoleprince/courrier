import { test, expect, type Page } from '@playwright/test';

/**
 * Un entrant « réponse attendue » marqué traité sans réponse rédigée (courriers
 * du seed imputés au service comptabilité) : l'entité traitante peut encore
 * rédiger la réponse depuis la fiche ; le bureau d'ordre ne le peut pas.
 */
async function ouvrirDemandeReductionTarifaire(page: Page) {
  await page.goto('/reponses-attendues');
  await page.getByText('Demande de réduction tarifaire').click();
  await expect(page.getByRole('heading', { name: 'Demande de réduction tarifaire' })).toBeVisible();
}

test('l’entité traitante peut rédiger une réponse oubliée', async ({ page }) => {
  await page.goto('/connexion');
  // Grâce a deux postes (chef comptabilité + intérim RH) : la connexion demande lequel.
  await page.getByRole('button', { name: 'Grâce Eyenga' }).first().click();
  await page.getByRole('button', { name: 'Chef du service comptabilité' }).click();
  await expect(page).toHaveURL('/');

  await ouvrirDemandeReductionTarifaire(page);
  await page.getByRole('button', { name: 'Rédiger la réponse' }).click();
  await expect(page).toHaveURL(/\/courriers\/sortants\/nouveau\?enReponseA=/);
  await expect(page.getByText(/En réponse à.*Demande de réduction tarifaire/)).toBeVisible();
});

test('le bureau d’ordre ne voit pas « Rédiger la réponse »', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Carine Ngo Bassong' }).click();
  await expect(page).toHaveURL('/');

  await ouvrirDemandeReductionTarifaire(page);
  await expect(page.getByText('Réponse attendue, non rédigée')).toHaveCount(0);
});
