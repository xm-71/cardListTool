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

/** Title → (first launch: skip the intro) → main menu. */
async function toMenu(page: Page, query: string) {
  await page.goto(`/?${query}`);
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.or(page.getByRole('menu', { name: 'Main menu' })).waitFor();
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeVisible();
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

type Fake = {
  server: { users: Map<string, { confirmed: boolean }> };
  emit(e: string): void;
};
const fake = (page: Page, run: (f: Fake) => void) => page.evaluate(`(${run.toString()})(window.__cloudFake)`);

for (const [name, width, height] of [
  ['desktop', 1400, 900],
  ['phone', 390, 844],
] as const) {
  test(`${name}: create an account, sign in, sign out and reset a password`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toMenu(page, 'e2e&cloud=fake');
    await page.getByRole('menuitem', { name: 'Options' }).click();
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    expect(await overflow(page), 'Account signed out scrolls sideways').toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByLabel('Email').fill('ash@example.com');
    await page.getByLabel('Password').fill('pikachu99');
    expect(await overflow(page), 'the form scrolls sideways').toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('status')).toContainText('Check your email to confirm your account.');
    await fake(page, (f) => (f.server.users.get('ash@example.com')!.confirmed = true));

    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByLabel('Email').fill('ash@example.com');
    await page.getByLabel('Password').fill('wrongwrong');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('Wrong email or password.');
    await page.getByLabel('Password').fill('pikachu99');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Signed in as ash@example.com')).toBeVisible();
    expect(await overflow(page), 'Account signed in scrolls sideways').toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/account-${name}.png`, fullPage: true });

    await fake(page, (f) => f.emit('passwordRecovery'));
    await expect(page.getByRole('dialog', { name: 'Choose a new password' })).toBeVisible();
    expect(await overflow(page), 'the recovery dialog scrolls sideways').toBeLessThanOrEqual(0);
    await page.getByLabel('New password', { exact: true }).fill('newpassword1');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByRole('dialog', { name: 'Choose a new password' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });
}

test('without the fake service there is no Account section and the game starts as before', async ({
  page,
}) => {
  await toMenu(page, 'e2e');
  await page.getByRole('menuitem', { name: 'Options' }).click();
  await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account' })).toHaveCount(0);
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('menuitem', { name: 'Duel' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Opponent' })).toBeVisible();
});
