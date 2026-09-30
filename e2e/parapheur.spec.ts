import { test, expect, type Page } from '@playwright/test';

/**
 * Parapheur du bureau d'ordre : les courriers enregistrés s'accumulent à la
 * première étape du circuit, puis sont transmis en un lot à l'imputation.
 */

async function changerUtilisateur(page: Page, nomComplet: string) {
  await page.getByRole('button', { name: /Changer d'utilisateur/ }).click();
  await page.getByRole('button', { name: nomComplet }).click();
}

test('le bureau d’ordre enregistre plusieurs courriers puis transmet le parapheur en une fois', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Carine Ngo Bassong' }).click();
  await expect(page).toHaveURL('/');

  // Deux enregistrements à la suite, grâce à « Enregistrer un autre courrier ».
  await page.goto('/courriers/entrants/nouveau');
  for (const objet of ['Parapheur e2e — premier', 'Parapheur e2e — second']) {
    await page.getByLabel('Objet').fill(objet);
    await page.getByRole('button', { name: 'Correspondant' }).click();
    await page.getByPlaceholder('Correspondant').fill('Bureautique');
    await page.getByRole('button', { name: 'Bureautique Plus', exact: true }).click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByRole('heading', { name: /enregistré/ })).toBeVisible();
    await page.getByRole('button', { name: /Enregistrer un autre/ }).click();
  }

  // Ils sont au parapheur, pas encore chez la SG.
  await page.goto('/parapheur');
  const main = page.getByRole('main');
  await expect(main.getByText('Parapheur e2e — premier')).toBeVisible();
  await expect(main.getByText('Parapheur e2e — second')).toBeVisible();

  await changerUtilisateur(page, 'Aïcha Bello');
  await page.goto('/corbeille');
  await expect(page.getByText('Parapheur e2e — premier')).toHaveCount(0);

  // Transmission du lot (sans bordereau, pour ne pas ouvrir d'onglet PDF).
  await changerUtilisateur(page, 'Carine Ngo Bassong');
  await page.goto('/parapheur');
  await page.getByLabel('Imprimer le bordereau de transmission').uncheck();
  await page.getByRole('button', { name: /Transmettre le parapheur/ }).click();
  await expect(main.getByText('Parapheur e2e — premier')).toHaveCount(0);

  await changerUtilisateur(page, 'Aïcha Bello');
  await page.goto('/corbeille');
  await expect(page.getByText('Parapheur e2e — premier')).toBeVisible();
  await expect(page.getByText('Parapheur e2e — second')).toBeVisible();
});
