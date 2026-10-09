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

/** Title → skip the first-launch intro → main menu. */
async function toMenu(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: /Pokémon Trading Card Game/ })).toBeVisible();
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.screenshot({ path: 'test-results/title.png', fullPage: true });
  await page.keyboard.press('Enter');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.or(page.getByRole('menu', { name: 'Main menu' })).waitFor();
  if (await skip.isVisible().catch(() => false)) {
    // Enter must open the name step, not answer it
    await expect(page.getByLabel('Your name')).toHaveValue('');
    await page.screenshot({ path: 'test-results/intro.png', fullPage: true });
    await skip.click();
  }
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeVisible();
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeFocused();
}

test('play a turn against the Medium bot', async ({ page }) => {
  await toMenu(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/menu.png', fullPage: true });
  await page.getByRole('menuitem', { name: 'Duel' }).click();
  await page.getByLabel('Medium bot').check();
  await expect(page.getByRole('group', { name: "Opponent's deck" })).toHaveCount(0); // bots pick at random
  await page.screenshot({ path: 'test-results/duel-setup.png', fullPage: true });
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
  await toMenu(page);
  await page.getByRole('menuitem', { name: 'Shop' }).click();
  await expect(page.getByText('¢ 500 credits')).toBeVisible();
  await page.screenshot({ path: 'test-results/shop.png', fullPage: true });
  await page
    .getByRole('group', { name: 'Mega Evolution' })
    .getByRole('button', { name: 'Buy & open' })
    .click();
  const opening = page.getByRole('dialog', { name: 'Pack opening' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/pack-shake.png' });
  await expect(opening.getByText('Card 0 of 10')).toBeVisible();
  await expect(page.getByText('¢ 350 credits')).toBeVisible();
  for (let i = 0; i < 3; i++) await opening.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/pack-flip.png' });
  await opening.getByRole('button', { name: 'Reveal all' }).click();
  await expect(opening.getByRole('img')).toHaveCount(10);
  await page.screenshot({ path: 'test-results/pack.png', fullPage: true });
  await opening.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('menuitem', { name: 'Binder' }).click();
  await page.getByRole('checkbox', { name: 'Owned only' }).check();
  const owned = page.getByRole('list', { name: 'Cards' }).getByRole('listitem');
  expect(await owned.count()).toBeGreaterThan(0);
  expect(await owned.count()).toBeLessThanOrEqual(10);
  // progress survives a reload (IndexedDB)
  await page.reload();
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('¢ 350 credits')).toBeVisible();
  await page.screenshot({ path: 'test-results/binder.png', fullPage: true });
});

test('(RF5) no horizontal scrolling at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= 375);
  await toMenu(page);
  expect(await fits()).toBe(true);
  for (const screen of ['Duel', 'Shop', 'Binder', 'Decks', 'Options']) {
    await page.getByRole('menuitem', { name: screen }).click();
    await page.screenshot({ path: `test-results/phone-${screen.toLowerCase()}.png`, fullPage: true });
    expect(await fits(), screen).toBe(true);
    await page.getByRole('button', { name: 'Back' }).click();
  }
  await page.goto('/');
  expect(await fits()).toBe(true);
});

for (const [width, height] of [
  [1280, 720],
  [1440, 900],
] as const) {
  test(`the battlefield fits a ${width}×${height} window without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toMenu(page);
    await page.getByRole('menuitem', { name: 'Duel' }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await playThroughSetup(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `test-results/board-${width}x${height}.png` });
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      view: window.innerHeight,
      scrollX: document.documentElement.scrollWidth,
      viewX: window.innerWidth,
    }));
    expect(overflow.scroll, 'page height').toBeLessThanOrEqual(overflow.view);
    expect(overflow.scrollX, 'page width').toBeLessThanOrEqual(overflow.viewX);
  });
}

test('with a crowded mid-game board, the hand stays on screen at 1280×720 and 1366×768', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?e2e');
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('menuitem', { name: 'Duel' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await playThroughSetup(page);
  // Fill both sides: 5 benched Pokémon with Energy and a Tool, energised Actives, discard piles, a 7-card hand.
  await page.evaluate(() => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const game = (window as unknown as { __game: Any }).__game;
    const s = structuredClone(game.getState().state) as Any;
    let n = 0;
    for (const p of s.players) {
      const take = (k: number) => p.deck.splice(0, k);
      // Benched Pokémon are fresh copies of this side's Active card.
      const copy = () => {
        const uid = `e2e-${n++}`;
        s.cards[uid] = { ...s.cards[p.active.stack[0]], uid };
        return uid;
      };
      const slot = () => ({
        ...structuredClone(p.active),
        stack: [copy()],
        energy: take(3),
        tool: take(1)[0],
        damage: 0,
      });
      p.active.energy = take(4);
      p.active.tool = take(1)[0];
      p.bench = Array.from({ length: 5 }, slot);
      p.discard = take(4);
      p.hand = [...p.hand, ...take(Math.max(0, 7 - p.hand.length))];
    }
    game.setState({ state: s });
  });
  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/crowded-${width}x${height}.png` });
    const hand = await page.getByRole('region', { name: 'Your hand' }).boundingBox();
    expect(hand, 'hand visible').not.toBeNull();
    expect(hand!.y + hand!.height, `hand bottom at ${width}x${height}`).toBeLessThanOrEqual(height);
    expect(hand!.height, 'hand not squashed').toBeGreaterThan(60);
  }
});

test('in a short window with a Stadium in play and a crowded board, the hand stays fully on screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/?e2e');
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('menuitem', { name: 'Duel' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await playThroughSetup(page);
  await page.evaluate(() => {
    type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const game = (window as unknown as { __game: Any }).__game;
    const s = structuredClone(game.getState().state) as Any;
    let n = 0;
    for (const p of s.players) {
      const take = (k: number) => p.deck.splice(0, k);
      const copy = () => {
        const uid = `e2e-${n++}`;
        s.cards[uid] = { ...s.cards[p.active.stack[0]], uid };
        return uid;
      };
      p.active.energy = take(4);
      p.bench = Array.from({ length: 5 }, () => ({
        ...structuredClone(p.active),
        stack: [copy()],
        energy: take(3),
        damage: 0,
      }));
      p.discard = take(4);
    }
    s.stadium = { uid: s.players[0].deck.shift(), owner: 0 };
    game.setState({ state: s });
  });
  for (const [width, height] of [
    [1280, 600],
    [1366, 657],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    const hand = await page.getByRole('region', { name: 'Your hand' }).boundingBox();
    expect(hand, 'hand visible').not.toBeNull();
    expect(hand!.y + hand!.height, `hand bottom at ${width}x${height}`).toBeLessThanOrEqual(height);
    expect(hand!.height, 'hand not squashed').toBeGreaterThan(60);
  }
});

test('collector mode: a free pack goes into a new binder, kept after a reload', async ({ page }) => {
  await toMenu(page);
  await page.getByRole('menuitem', { name: 'Options' }).click();
  // The switch flips once the profile is saved, so click and wait rather than check().
  const collector = page.getByRole('checkbox', { name: 'Collector mode' });
  await collector.click();
  await expect(collector).toBeChecked();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('menuitem', { name: 'Duel' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/collector-menu.png', fullPage: true });

  await page.getByRole('menuitem', { name: 'Shop' }).click();
  const pack = page.getByRole('group', { name: 'Mega Evolution' });
  await expect(pack.getByText('FREE')).toBeVisible();
  await pack.getByRole('button', { name: 'Buy & open' }).click();
  const opening = page.getByRole('dialog', { name: 'Pack opening' });
  await opening.getByRole('button', { name: 'Reveal all' }).click();
  await opening.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('menuitem', { name: 'Binder' }).click();
  await page.getByRole('tab', { name: 'My binders' }).click();
  await page.getByRole('button', { name: 'New binder' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit binder' });
  await editor.getByLabel('Binder name').fill('Best pulls');
  await editor.getByRole('radiogroup', { name: 'Cover colour' }).getByRole('radio', { name: 'blue' }).click();
  await editor.getByRole('radio', { name: 'stars' }).click();
  await editor.getByLabel('Top left sticker').selectOption('crown');
  await editor.getByLabel('Bottom right sticker').selectOption('heart');
  await page.screenshot({ path: 'test-results/binder-editor.png', fullPage: true });
  await editor.getByRole('button', { name: 'Save' }).click();
  await page.screenshot({ path: 'test-results/binder-shelf.png', fullPage: true });

  await page.getByRole('button', { name: 'Open Best pulls' }).click();
  await page.getByRole('button', { name: 'Empty slot 1' }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a card' });
  await picker.locator('li button:not([disabled])').first().click();
  await expect(page.getByRole('button', { name: /^Slot 1: / })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/binder-book.png', fullPage: true });

  await page.reload();
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Binder' }).click();
  await page.getByRole('tab', { name: 'My binders' }).click();
  await expect(page.getByRole('button', { name: 'Open Best pulls' })).toContainText('1 card');
});

test('My binders has no horizontal scrolling at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= 375);
  await toMenu(page);
  await page.getByRole('menuitem', { name: 'Binder' }).click();
  await page.getByRole('tab', { name: 'My binders' }).click();
  await page.getByRole('button', { name: 'New binder' }).click();
  expect(await fits(), 'editor').toBe(true);
  await page.getByRole('dialog', { name: 'Edit binder' }).getByRole('button', { name: 'Save' }).click();
  expect(await fits(), 'shelf').toBe(true);
  await page.getByRole('button', { name: /^Open / }).click();
  await page.getByRole('button', { name: 'Add page' }).click();
  await page.screenshot({ path: 'test-results/phone-binder-book.png', fullPage: true });
  expect(await fits(), 'book').toBe(true);
  await page.getByRole('button', { name: 'Empty slot 1' }).click();
  expect(await fits(), 'picker').toBe(true);
});

test('Gym Challenge: fight Brock with a starter deck, and check the screen at desktop and phone widths', async ({
  page,
}) => {
  await toMenu(page);
  await page.getByRole('menuitem', { name: 'Gym Challenge' }).click();
  await expect(page.getByRole('list', { name: 'Badge case' })).toBeVisible();
  await page.screenshot({ path: 'test-results/gym-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 375), 'badge case').toBe(true);
  await page.screenshot({ path: 'test-results/gym-phone.png', fullPage: true });
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.getByRole('button', { name: 'Challenge Brock' }).click();
  await expect(page.getByText("Brock's Gym")).toBeVisible();
  await page.screenshot({ path: 'test-results/gym-setup.png', fullPage: true });
  await page.getByRole('button', { name: 'Battle!' }).click();
  await playThroughSetup(page);
  await expect(page.getByRole('region', { name: 'Opponent' })).toBeVisible();
  await page.getByRole('button', { name: 'End turn' }).click();
  await expect
    .poll(
      async () =>
        (await page.getByRole('button', { name: 'End turn' }).isVisible()) ||
        (await page.getByRole('dialog', { name: 'Game over' }).isVisible()),
      { timeout: 60_000 },
    )
    .toBe(true);
});

test('with all 8 badges the Elite Four panel is ready', async ({ page }) => {
  await toMenu(page, '/?e2e');
  await page.evaluate(() => {
    const store = (
      window as unknown as { __profile: { setState(s: unknown): void; getState(): { profile: object } } }
    ).__profile;
    const ids = ['brock', 'misty', 'surge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni'];
    store.setState({
      profile: { ...store.getState().profile, gym: { badges: ids, run: null, hallOfFame: [] } },
    });
  });
  await page.getByRole('menuitem', { name: 'Gym Challenge' }).click();
  await expect(page.getByRole('button', { name: 'Start Elite Four' })).toBeEnabled();
  await expect(page.getByText('Badges: 8 / 8')).toBeVisible();
  await page.screenshot({ path: 'test-results/gym-elite.png', fullPage: true });
});

test('on a phone the battle log can be hidden, and a long press opens a card full size', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('menuitem', { name: 'Duel' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await playThroughSetup(page);

  // The log starts hidden on a phone and a button shows it.
  const log = page.getByRole('region', { name: 'Game log' });
  await expect(log).toBeHidden();
  await page.getByRole('button', { name: 'Show log' }).click();
  await expect(log).toBeVisible();
  await page.getByRole('button', { name: 'Hide log' }).click();
  await expect(log).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 375), 'no sideways scroll').toBe(
    true,
  );

  // Press and hold one of your cards (about 0.7 s) to see it large.
  const card = page.getByRole('region', { name: 'You', exact: true }).locator('[data-uid]').first();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const view = page.getByRole('dialog', { name: 'Card view' });
  await expect(view).toBeVisible();
  await page.screenshot({ path: 'test-results/card-view-phone.png' });
  await view.getByRole('button', { name: 'Close' }).click();
  await expect(view).toBeHidden();
});
