import { expect, test, type Page } from '@playwright/test';

/** Answer setup prompts (first card, then Done) until the human can act on the board. */
async function playThroughSetup(page: Page) {
  const endTurn = page.getByRole('button', { name: 'End turn' });
  for (let i = 0; i < 40; i++) {
    if (await endTurn.isVisible()) return;
    const dialog = page.getByRole('dialog').filter({ hasNot: page.getByText('Game over') });
    if (await dialog.isVisible()) {
      const done = dialog.getByRole('button', { name: 'Done' });
      if (await done.isVisible()) await done.click();
      else await dialog.getByRole('button').first().click();
    }
    await page.waitForTimeout(500);
  }
  throw new Error('never reached the human turn');
}

test('play a turn against the Medium bot', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pokémon TCG' })).toBeVisible();
  await page.getByLabel('Medium bot').check();
  await page
    .getByRole('group', { name: "Opponent's deck" })
    .getByRole('button', { name: /Mega Lucario ex/ })
    .click();
  await page.getByRole('button', { name: 'Play' }).click();
  await playThroughSetup(page);
  await expect(page.getByRole('region', { name: 'You', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Opponent' })).toBeVisible();
  await page.screenshot({ path: 'test-results/board.png', fullPage: true });
  const log = page.getByRole('region', { name: 'Game log' });
  const turnsBefore = await log.getByText(/^Turn \d+:/).count();
  await page.getByRole('button', { name: 'End turn' }).click();
  // the bot takes its turn and play comes back to us (or the game ends)
  await expect
    .poll(
      async () =>
        (await page.getByRole('dialog', { name: 'Game over' }).isVisible()) ||
        (await log.getByText(/^Turn \d+:/).count()) >= turnsBefore + 2,
      {
        timeout: 60_000,
      },
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/after-bot-turn.png', fullPage: true });
});

test('buy and open a pack, then find the cards in the binder', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shop' }).click();
  await expect(page.getByText('500 credits')).toBeVisible();
  await page
    .getByRole('group', { name: 'Mega Evolution' })
    .getByRole('button', { name: 'Buy & open' })
    .click();
  const opening = page.getByRole('dialog', { name: 'Pack opening' });
  await expect(opening.getByText('Card 1 of 10')).toBeVisible();
  await expect(page.getByText('350 credits')).toBeVisible();
  await opening.getByRole('button', { name: 'Reveal all' }).click();
  await expect(opening.getByRole('img')).toHaveCount(10);
  await page.screenshot({ path: 'test-results/pack.png', fullPage: true });
  await opening.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Binder' }).click();
  await page.getByRole('checkbox', { name: 'Owned only' }).check();
  const owned = page.getByRole('list', { name: 'Cards' }).getByRole('listitem');
  expect(await owned.count()).toBeGreaterThan(0);
  expect(await owned.count()).toBeLessThanOrEqual(10);
  // progress survives a reload (IndexedDB)
  await page.reload();
  await expect(page.getByText('350 credits')).toBeVisible();
  await page.screenshot({ path: 'test-results/binder.png', fullPage: true });
});
