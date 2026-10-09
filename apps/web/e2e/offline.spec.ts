import { expect, test } from '@playwright/test';

test('after one visit the app reloads and runs with no connection', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Pokémon Trading Card Game/ })).toBeVisible();
  // The service worker installs, caches the whole build, then takes control.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), { timeout: 20_000 })
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shell = keys.find((k) => k.startsWith('shell-'));
    if (!shell) return [];
    return (await (await caches.open(shell)).keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached).toContain('/manifest.webmanifest');
  expect(cached.filter((p) => p.endsWith('.js')).length).toBeGreaterThanOrEqual(2); // the app and the bot worker

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Pokémon Trading Card Game/ })).toBeVisible();
  await page.keyboard.press('Enter');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.or(page.getByRole('menu', { name: 'Main menu' })).waitFor();
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeVisible();
  await context.setOffline(false);
});

test('the web app manifest is served and linked', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});
