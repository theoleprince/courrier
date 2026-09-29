import { test, expect } from '@playwright/test';

/**
 * Lien de vérification envoyé dans l'e-mail de réponse, ouvert sur un autre poste :
 * la signature y est inconnue et le destinataire n'a pas le PDF. La page propose
 * d'abord le suivi par code (pré-rempli par le lien), ou la vérification d'un document.
 */
test('lien de vérification : suivi par code pré-rempli, ou dépôt du document', async ({ page }) => {
  await page.goto('/verifier/signature-inconnue?code=ABEN-2345');
  await expect(page.getByRole('tab', { name: 'Code de suivi' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByPlaceholder('XXXX-XXXX')).toHaveValue('ABEN-2345');
  await page.getByLabel(/Nom/).fill('Abe');
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page.getByText(/En cours de traitement par/)).toBeVisible();

  await page.getByRole('tab', { name: 'Document signé' }).click();
  await expect(page.getByRole('tab', { name: 'Document signé' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Déposez le PDF que vous avez reçu')).toBeVisible();

  // Le portail utilise le même formulaire.
  await page.goto('/portail?code=ABEN-2345');
  await page.getByLabel(/Nom/).fill('Abe');
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page.getByText(/En cours de traitement par/)).toBeVisible();
});
