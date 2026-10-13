import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ptcg.settings', JSON.stringify({ animations: 'off', sound: false }));
    } catch {
      // no storage: the defaults apply
    }
  });
});

/** Title → (first launch: skip the intro) → main menu. `?e2e` exposes the stores to the test. */
async function toMenu(page: Page) {
  await page.goto('/?e2e');
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.or(page.getByRole('menu', { name: 'Main menu' })).waitFor();
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeVisible();
}

/** Credits go into the saved profile (purchases read the saved one), then into what the screen shows. */
async function giveCredits(page: Page, credits: number) {
  await page.evaluate(async (n) => {
    type Store = {
      getState(): { profile: object; store: { save(p: object): Promise<void> } };
      setState(s: unknown): void;
    };
    const store = (window as unknown as { __profile: Store }).__profile;
    const profile = { ...store.getState().profile, credits: n };
    await store.getState().store.save(profile);
    store.setState({ profile });
  }, credits);
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [name, width, height] of [
  ['desktop', 1400, 900],
  ['phone', 390, 844],
] as const) {
  test(`${name}: buy a theme deck in the Poké Mart, then play a Duel with it`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toMenu(page);
    await giveCredits(page, 5000);

    await page.getByRole('menuitem', { name: 'Shop' }).click();
    await page.getByRole('tab', { name: 'Decks' }).click();
    await expect(page.getByRole('region', { name: 'Theme decks' })).toBeVisible();
    expect(await overflow(page), 'the Decks tab scrolls sideways').toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/deck-shop-${name}.png`, fullPage: true });

    await page.getByRole('button', { name: 'View Mega Charizard X ex' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mega Charizard X ex' });
    await expect(sheet.getByRole('region', { name: 'Deck list' })).toBeVisible();
    expect(await overflow(page), 'the deck sheet scrolls sideways').toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/deck-shop-sheet-${name}.png` });
    await sheet.getByRole('button', { name: 'Buy for 600 credits' }).click();
    await expect(sheet.getByText('Added to your decks. 60 cards added to your binder.')).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('button', { name: 'View Mega Charizard X ex' })).toContainText('OWNED');

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('menuitem', { name: 'Duel' }).click();
    const yours = page.getByRole('group', { name: 'Your deck' });
    await expect(yours.getByRole('button', { name: /Mega Charizard X ex/ })).toBeVisible();
    await expect(yours.getByRole('button', { name: /Mega Diancie ex/ })).toHaveCount(0);
    await yours.getByRole('button', { name: /Mega Charizard X ex/ }).click();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('region', { name: /^You$/ })).toBeVisible();
  });
}
