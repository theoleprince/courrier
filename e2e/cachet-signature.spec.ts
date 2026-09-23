import { test, expect, type Page } from '@playwright/test';

/**
 * Cachet numérique et signature importée : l'administrateur téléverse le cachet
 * de l'organisation, puis le DG signe dans le parapheur avec une image de
 * signature importée et le cachet apposé.
 */

/** Fabrique une image PNG dans le navigateur (fond blanc, comme un scan papier). */
async function imagePng(page: Page, dessin: 'cachet' | 'signature'): Promise<Buffer> {
  const dataUrl = await page.evaluate((type) => {
    const canvas = document.createElement('canvas');
    canvas.width = type === 'cachet' ? 200 : 300;
    canvas.height = type === 'cachet' ? 200 : 100;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = type === 'cachet' ? '#1d4ed8' : '#111111';
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (type === 'cachet') ctx.arc(100, 100, 85, 0, Math.PI * 2);
    else ctx.bezierCurveTo(20, 80, 150, -40, 280, 70);
    ctx.stroke();
    return canvas.toDataURL('image/png');
  }, dessin);
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

test('cachet téléversé puis apposé avec une signature importée', async ({ page }) => {
  // 1) L'administrateur téléverse le cachet.
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Admin POC' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/admin/personnalisation');
  await page.getByRole('tab', { name: 'Apparence et langue' }).or(page.getByRole('button', { name: 'Apparence et langue' })).click();
  const champCachet = page.locator('label', { hasText: 'Cachet numérique' }).locator('input[type=file]');
  await champCachet.setInputFiles({ name: 'cachet.png', mimeType: 'image/png', buffer: await imagePng(page, 'cachet') });
  await expect(page.locator('label', { hasText: 'Cachet numérique' }).locator('img')).toBeVisible();

  // 2) Le DG signe le premier courrier du parapheur avec une signature importée et le cachet.
  await page.getByRole('button', { name: /Changer d'utilisateur/ }).click();
  await page.getByRole('button', { name: 'Paul Mbarga' }).click();
  await page.goto('/parapheur');
  await page.locator('main input[type=checkbox]').first().check();
  await page.getByRole('button', { name: /^Signer/ }).click();

  const modale = page.getByRole('dialog');
  await modale.locator('input[type=file]').setInputFiles({
    name: 'signature.png',
    mimeType: 'image/png',
    buffer: await imagePng(page, 'signature'),
  });
  const caseCachet = modale.getByRole('checkbox', { name: /Apposer le cachet/ });
  await expect(caseCachet).toBeChecked();
  await expect(modale.getByRole('button', { name: 'Signer', exact: true })).toBeEnabled();
  await modale.getByRole('button', { name: 'Signer', exact: true }).click();
  await expect(modale).toHaveCount(0);

  // 3) La signature est tracée au journal avec le cachet.
  const avecCachet = await page.evaluate(
    () =>
      new Promise<boolean>((resoudre, rejeter) => {
        const ouverture = indexedDB.open('gestion-courrier');
        ouverture.onerror = () => rejeter(ouverture.error);
        ouverture.onsuccess = () => {
          const requete = ouverture.result.transaction('historique').objectStore('historique').getAll();
          requete.onsuccess = () => {
            const signatures = (requete.result as { action: string; sequence: number; details?: { avecCachet?: boolean } }[])
              .filter((h) => h.action === 'SIGNATURE')
              .sort((a, b) => a.sequence - b.sequence);
            resoudre(!!signatures.at(-1)?.details?.avecCachet);
          };
        };
      }),
  );
  expect(avecCachet).toBe(true);
});
