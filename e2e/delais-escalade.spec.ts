import { test, expect } from '@playwright/test';

/**
 * Scénario E (section 19) : avancer l'horloge de démonstration déclenche
 * verifierEcheances() (section 11.1) et fait apparaître de nouvelles
 * notifications de retard ; revenir au présent puis rejouer le même saut ne
 * doit pas dupliquer les notifications (dédoublonnage par `cle`, section
 * 11.2). Paul Mbarga (DG) a des sortants en attente de sa signature dont
 * l'échéance est proche (2 jours) : une semaine suffit à les rendre en retard.
 */
test('scénario E : avancer l’horloge crée des notifications sans les dupliquer', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Paul Mbarga', exact: true }).click();
  await expect(page).toHaveURL('/');

  const badge = page.locator('[data-testid="badge-notifications"]');
  const lireCompte = async () => ((await badge.count()) > 0 ? Number(await badge.textContent()) : 0);
  // verifierEcheances() crée les notifications une par une : on attend que le
  // compteur ne bouge plus avant de le relever, sinon on lit une valeur intermédiaire.
  const lireCompteStable = async () => {
    let precedent = await lireCompte();
    for (let stables = 0; stables < 3; ) {
      await page.waitForTimeout(700);
      const actuel = await lireCompte();
      stables = actuel === precedent ? stables + 1 : 0;
      precedent = actuel;
    }
    return precedent;
  };
  const compteInitial = await lireCompteStable();

  await page.getByRole('button', { name: /\+1 semaine/ }).click();
  await expect
    .poll(lireCompte, { message: 'le compteur de notifications doit augmenter après le saut d’horloge', timeout: 20_000 })
    .toBeGreaterThan(compteInitial);
  const compteApresAvance = await lireCompteStable();

  // Revenir au présent, puis rejouer exactement le même saut : pas de doublon.
  await page.getByRole('button', { name: /Revenir au présent/ }).click();
  await lireCompteStable();
  await page.getByRole('button', { name: /\+1 semaine/ }).click();
  expect(await lireCompteStable(), 'le rejeu ne doit pas dupliquer les notifications').toBe(compteApresAvance);
});
