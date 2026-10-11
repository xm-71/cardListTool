import { expect, test, type Page } from '@playwright/test';

/** Answer setup prompts (first card, then Done) until the human can act on the board. */
async function playThroughSetup(page: Page) {
  const endTurn = page.getByRole('button', { name: 'End turn' });
  for (let i = 0; i < 60; i++) {
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

test("with animations on, the opponent's turn plays out (banner first) and the board ends in the game's state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2e');
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('menuitem', { name: 'Duel' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await playThroughSetup(page);

  await page.getByRole('button', { name: 'End turn' }).click();
  // The opponent's turn opens with a banner, and the board takes no input while it plays.
  await expect(page.locator('#fx-layer').getByText("Opponent's turn")).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'test-results/anim-banner.png' });
  await expect(page.getByRole('button', { name: 'End turn' })).toBeHidden();
  // The ticker reads the Rival's moves out, and Skip hurries the rest of their turn along.
  await expect(page.getByRole('status')).toContainText('Rival');
  await page.screenshot({ path: 'test-results/anim-ticker.png' });
  await page.getByRole('button', { name: /Skip/ }).click();
  // Back to you: your banner plays and End turn returns.
  await expect(page.getByRole('button', { name: 'End turn' })).toBeVisible({ timeout: 60_000 });
  const engine = await page.evaluate(() => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const s = (window as unknown as { __game: Any }).__game.getState().state;
    return { hand: s.players[1].hand.length, turn: s.turn };
  });
  await expect(page.getByRole('region', { name: 'Opponent' }).getByText(`Hand ${engine.hand}`)).toBeVisible();
  await expect(page.getByText(`Turn ${engine.turn} · Your turn`)).toBeVisible();
  expect(await page.locator('#fx-layer > *').count(), 'no animation left behind').toBe(0);
});
