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

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** A Hall of Fame entry in the saved profile, as if the Kanto Champion had been beaten. */
async function beatKantoChampion(page: Page, badges: string[] = []) {
  await page.evaluate(async (earned) => {
    type Store = {
      getState(): { profile: { gym: object }; store: { save(p: object): Promise<void> } };
      setState(s: unknown): void;
    };
    const store = (window as unknown as { __profile: Store }).__profile;
    const base = store.getState().profile;
    const entry = { date: '2026-10-13', playerName: 'ASH', deckName: 'Deck', cover: 'me01-077' };
    const profile = { ...base, gym: { ...base.gym, hallOfFame: [entry], badges: earned } };
    await store.getState().store.save(profile);
    store.setState({ profile });
  }, badges);
}

for (const [name, width, height] of [
  ['desktop', 1400, 900],
  ['phone', 390, 844],
] as const) {
  test(`${name}: the Johto tab is locked, then opens after the Kanto Champion, and Falkner can be challenged`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await toMenu(page);
    await page.getByRole('menuitem', { name: 'Gym Challenge' }).click();
    await page.getByRole('tab', { name: 'Johto' }).click();
    await expect(page.getByText('Beat the Kanto Champion to travel to Johto.')).toBeVisible();
    expect(await overflow(page), 'the locked Johto tab scrolls sideways').toBeLessThanOrEqual(0);

    await beatKantoChampion(page);
    await page.getByRole('tab', { name: 'Kanto' }).click();
    await page.getByRole('tab', { name: 'Johto' }).click();
    const tiles = page.getByRole('list', { name: 'Johto badge case' }).getByRole('listitem');
    await expect(tiles).toHaveCount(8);
    expect(await overflow(page), 'the Johto badge case scrolls sideways').toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/johto-${name}.png`, fullPage: true });

    await page.getByRole('button', { name: 'Challenge Falkner' }).click();
    await expect(page.getByText("Falkner's Gym")).toBeVisible();
    expect(await overflow(page), 'the Johto match setup scrolls sideways').toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Battle!' }).click();
    await expect(page.getByRole('region', { name: 'Opponent' })).toBeVisible();
  });
}

for (const [name, width, height] of [
  ['desktop', 1400, 900],
  ['phone', 390, 844],
] as const) {
  test(`${name}: with seven Johto badges Clair is next and her match starts`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toMenu(page);
    await beatKantoChampion(page, ['falkner', 'bugsy', 'whitney', 'morty', 'chuck', 'jasmine', 'pryce']);
    await page.getByRole('menuitem', { name: 'Gym Challenge' }).click();
    await page.getByRole('tab', { name: 'Johto' }).click();
    await expect(page.getByText(/Badges: 7 \/ 8/)).toBeVisible();
    await expect(page.getByText('Coming soon')).toHaveCount(0);
    expect(await overflow(page), 'the full Johto case scrolls sideways').toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/johto-full-${name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Challenge Clair' }).click();
    await expect(page.getByText("Clair's Gym")).toBeVisible();
    await page.getByRole('button', { name: 'Battle!' }).click();
    await expect(page.getByRole('region', { name: 'Opponent' })).toBeVisible();
  });
}

for (const [name, width, height] of [
  ['desktop', 1400, 900],
  ['phone', 390, 844],
] as const) {
  test(`${name}: with eight Johto badges the Elite Four starts with Will`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toMenu(page);
    const all = ['brock', 'misty', 'surge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni'];
    const johto = ['falkner', 'bugsy', 'whitney', 'morty', 'chuck', 'jasmine', 'pryce', 'clair'];
    await beatKantoChampion(page, [...all, ...johto]);
    await page.getByRole('menuitem', { name: 'Gym Challenge' }).click();
    await page.getByRole('tab', { name: 'Johto' }).click();
    await expect(page.getByText(/Badges: 8 \/ 8/)).toBeVisible();
    await expect(page.getByRole('list', { name: 'Elite Four order' })).toContainText('Champion Lance');
    expect(await overflow(page), 'the Johto Elite Four panel scrolls sideways').toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/johto-elite-${name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Start Elite Four' }).click();
    await expect(page.getByText('Will', { exact: true }).first()).toBeVisible();
    expect(await overflow(page), 'the Elite Four match setup scrolls sideways').toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Battle!' }).click();
    await expect(page.getByRole('region', { name: 'Opponent' })).toBeVisible();
    const context = await page.evaluate(
      () =>
        (
          window as unknown as {
            __game: { getState(): { config: { context: { kind: string; stage: number; region?: string } } } };
          }
        ).__game.getState().config.context,
    );
    expect(context).toMatchObject({ kind: 'elite', stage: 0, region: 'johto' });
  });
}

for (const [name, width, height] of [
  ['desktop', 1400, 900],
  ['phone', 390, 844],
] as const) {
  test(`${name}: after the Johto Champion, Red can be challenged on Mt. Silver`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toMenu(page);
    await page.evaluate(async () => {
      type Store = {
        getState(): { profile: { gym: object }; store: { save(p: object): Promise<void> } };
        setState(s: unknown): void;
      };
      const store = (window as unknown as { __profile: Store }).__profile;
      const base = store.getState().profile;
      const entry = { date: '2026-10-14', playerName: 'ASH', deckName: 'Deck', cover: 'me01-077' };
      const gym = { ...base.gym, hallOfFame: [{ ...entry, region: 'johto' }, entry] };
      const profile = { ...base, gym };
      await store.getState().store.save(profile);
      store.setState({ profile });
    });
    await page.getByRole('menuitem', { name: 'Gym Challenge' }).click();
    await page.getByRole('tab', { name: 'Johto' }).click();
    await expect(page.getByText('Mt. Silver', { exact: true })).toBeVisible();
    expect(await overflow(page), 'the Mt. Silver panel scrolls sideways').toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/johto-red-${name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Challenge Red' }).click();
    expect(await overflow(page), 'the Red match setup scrolls sideways').toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Battle!' }).click();
    await expect(page.getByRole('region', { name: 'Opponent' })).toBeVisible();
    const kind = await page.evaluate(
      () =>
        (
          window as unknown as { __game: { getState(): { config: { context: { kind: string } } } } }
        ).__game.getState().config.context.kind,
    );
    expect(kind).toBe('red');
  });
}
