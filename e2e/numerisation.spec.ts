import { test, expect, type Page } from '@playwright/test';

/**
 * Numérisation d'un courrier papier avec la caméra : une capture par page,
 * assemblées en un PDF joint au courrier. La caméra est simulée par le flux
 * vidéo de test de Chromium / Edge.
 */

async function ouvrirEnregistrement(page: Page) {
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Carine Ngo Bassong' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/courriers/entrants/nouveau');
  await page.getByRole('button', { name: 'Numériser avec la caméra' }).click();
}

// Caméra simulée pour tout le fichier ; l'autorisation est accordée (ou non) test par test.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream'] } });

test.describe('caméra disponible', () => {
  test.use({ permissions: ['camera'] });

  test('deux pages capturées deviennent le scan PDF du courrier', async ({ page }) => {
    await ouvrirEnregistrement(page);
    const modale = page.getByRole('dialog', { name: 'Numériser le courrier' });

    // Attendre que le flux vidéo soit réellement lu avant de capturer.
    await expect.poll(() => modale.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
    await modale.getByRole('button', { name: 'Capturer la page 1' }).click();
    await expect(modale.getByRole('img', { name: 'Page 1' })).toBeVisible();
    await modale.getByLabel(/Effet scanner/).uncheck();
    await modale.getByRole('button', { name: 'Capturer la page 2' }).click();
    await expect(modale.getByRole('img', { name: 'Page 2' })).toBeVisible();

    // Supprimer une page puis la reprendre.
    await modale.getByTitle('Supprimer cette page').last().click();
    await expect(modale.getByRole('img', { name: 'Page 2' })).toHaveCount(0);
    await modale.getByRole('button', { name: 'Capturer la page 2' }).click();

    await modale.getByRole('button', { name: 'Terminer (2 pages)' }).click();
    await expect(modale).toBeHidden();
    await expect(page.getByText(/numerisation-\d+\.pdf/).first()).toBeVisible();

    await page.getByLabel('Objet').fill('Courrier numérisé — e2e');
    await page.getByRole('button', { name: 'Correspondant' }).click();
    await page.getByPlaceholder('Correspondant').fill('Bureautique');
    await page.getByRole('button', { name: 'Bureautique Plus', exact: true }).click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await page.getByRole('button', { name: 'Voir le détail complet' }).click();

    // Le scan est la pièce du courrier.
    await page.getByRole('tab', { name: 'Pièces' }).click();
    await expect(page.getByRole('main').getByText(/scan\.pdf/).first()).toBeVisible();
  });
});

test('caméra refusée : message clair et repli sur la prise de photo', async ({ page, context }) => {
  await context.clearPermissions();
  await ouvrirEnregistrement(page);
  const modale = page.getByRole('dialog', { name: 'Numériser le courrier' });
  await expect(modale.getByText(/accès à la caméra a été refusé|Aucune caméra disponible|ne donne pas accès/)).toBeVisible();
  await expect(modale.getByText('Prendre une photo avec l’appareil')).toBeVisible();
  await expect(modale.getByRole('button', { name: /Terminer/ })).toBeDisabled();
});
