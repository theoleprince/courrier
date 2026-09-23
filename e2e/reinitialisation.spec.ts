import { test, expect } from '@playwright/test';

/**
 * Réinitialisation de la démo : la base est recréée avec de nouveaux
 * identifiants. La session enregistrée ne doit pas survivre (sinon écran
 * blanc), et l'application doit refonctionner normalement, y compris dans un
 * second onglet resté ouvert pendant la réinitialisation.
 */
test('après réinitialisation, retour à la connexion et application fonctionnelle', async ({ page, context }) => {
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Carine Ngo Bassong' }).click();
  await expect(page).toHaveURL('/');

  const autreOnglet = await context.newPage();
  await autreOnglet.goto('/courriers/entrants');
  await expect(autreOnglet.getByText('ARR-2026-000014')).toBeVisible();

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: /Réinitialiser la démo/ }).click();
  await expect(page).toHaveURL('/connexion');

  // Une URL interne ouverte avec l'ancienne session doit renvoyer à la connexion, pas afficher un écran blanc.
  await page.goto('/courriers/entrants');
  await expect(page).toHaveURL('/connexion');

  await page.getByRole('button', { name: 'Carine Ngo Bassong' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/courriers/entrants');
  await expect(page.getByText('ARR-2026-000014')).toBeVisible();

  // L'onglet resté ouvert fonctionne sur la nouvelle base (même session que le premier onglet).
  await autreOnglet.goto('/courriers/entrants');
  await expect(autreOnglet.getByText('ARR-2026-000014')).toBeVisible();
});
