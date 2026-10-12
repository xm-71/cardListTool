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

/** Title → (first launch: skip the intro) → main menu. `?e2e` exposes the game store to the test. */
async function toMenu(page: Page) {
  await page.goto('/?e2e');
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.or(page.getByRole('menu', { name: 'Main menu' })).waitFor();
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeVisible();
}

/** No sideways scrolling at the current viewport width. */
async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${where} scrolls sideways`).toBeLessThanOrEqual(0);
}

test('a run: start, pick a starter, win fight 1, take an offer, reload to fight 2', async ({ page }) => {
  await toMenu(page);
  await page.getByRole('menuitem', { name: 'Battle Frontier' }).click();
  await page.getByRole('button', { name: 'Start run' }).click();
  await page.getByRole('list', { name: 'Starter decks' }).getByRole('button').first().click();
  await expect(page.getByText('Lives: 2')).toBeVisible();
  await expect(page.getByText('Fight 1 of 8')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalScroll(page, 'the hub');
  await page.screenshot({ path: 'test-results/frontier-hub-phone.png', fullPage: true });
  await page.setViewportSize({ width: 1400, height: 950 });

  await page.getByRole('button', { name: 'Fight' }).click();
  // The bot gives up: a win for the player.
  await page.waitForFunction(() => {
    const w = window as unknown as { __game?: { getState(): { state: unknown } } };
    return !!w.__game?.getState().state;
  });
  await page.evaluate(() => {
    const w = window as unknown as {
      __game: { getState(): { dispatch(p: 0 | 1, a: { type: 'concede' }): void } };
    };
    w.__game.getState().dispatch(1, { type: 'concede' });
  });
  const over = page.getByRole('dialog', { name: 'Game over' });
  await expect(over.getByText('You win!')).toBeVisible();
  await over.getByRole('button', { name: 'Continue' }).click();

  const offers = page.getByRole('list', { name: 'Offers' });
  await expect(offers).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalScroll(page, 'the reward screen');
  await page.screenshot({ path: 'test-results/frontier-reward-phone.png', fullPage: true });

  await page.getByRole('button', { name: 'Take offer 1' }).click();
  const picker = page.getByRole('region', { name: 'Cut cards' });
  await expect(picker).toBeVisible();
  await expectNoHorizontalScroll(page, 'the cut picker');
  await page.screenshot({ path: 'test-results/frontier-cut-phone.png', fullPage: true });
  await page.setViewportSize({ width: 1400, height: 950 });

  const confirm = picker.getByRole('button', { name: 'Confirm cut' });
  for (let i = 0; i < 4 && !(await confirm.isEnabled()); i++)
    await picker
      .getByRole('button', { name: /^Cut .*Energy$/ })
      .and(page.locator(':enabled'))
      .first()
      .click();
  await confirm.click();
  await expect(page.getByText('Fight 2 of 8')).toBeVisible();

  await page.reload();
  await toMenu(page);
  await page.getByRole('menuitem', { name: 'Battle Frontier' }).click();
  await expect(page.getByText('Fight 2 of 8')).toBeVisible();
  await expect(page.getByText('Lives: 2')).toBeVisible();
});

test('the Frontier Hall of Fame fits a phone screen', async ({ page }) => {
  await toMenu(page);
  await page.evaluate(() => {
    const w = window as unknown as {
      __profile: { setState(f: (s: { profile: object }) => object): void };
    };
    const entry = {
      date: '2026-10-12',
      playerName: 'WWWWWWWWWW',
      deckName: 'Mega Charizard X ex',
      cover: 'me02-056',
      livesLeft: 2,
    };
    w.__profile.setState((s) => ({
      profile: { ...s.profile, frontier: { run: null, hallOfFame: [entry, entry] } },
    }));
  });
  await page.getByRole('menuitem', { name: 'Battle Frontier' }).click();
  await expect(page.getByRole('list', { name: 'Frontier Hall of Fame' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalScroll(page, 'the Hall of Fame');
  await page.screenshot({ path: 'test-results/frontier-hall-phone.png', fullPage: true });
});
