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

async function toMenu(page: Page) {
  await page.goto('/');
  await expect(page.getByText('PRESS START')).toBeVisible();
  await page.keyboard.press('Enter');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.or(page.getByRole('menu', { name: 'Main menu' })).waitFor();
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeVisible();
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('the town square fills the desktop menu and arrow keys walk it', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await toMenu(page);
  const menu = page.getByRole('menu', { name: 'Main menu' });
  await expect(menu.getByRole('menuitem')).toHaveCount(8);
  await page.screenshot({ path: 'test-results/town-desktop.png', fullPage: true });
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('town-dialog')).toContainText('Packs cost 150 credits');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('the whole square fits without sideways scrolling, and a building takes two taps', async ({ page }) => {
    await toMenu(page);
    expect(await overflow(page), 'the town scrolls sideways').toBeLessThanOrEqual(0);
    const menu = page.getByRole('menu', { name: 'Main menu' });
    for (const item of await menu.getByRole('menuitem').all()) await expect(item).toBeInViewport();
    await page.screenshot({ path: 'test-results/town-phone.png', fullPage: true });

    const gym = page.getByRole('menuitem', { name: 'Gym Challenge' });
    await gym.tap();
    await expect(gym).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('town-dialog')).toContainText('0 of 8 badges');
    await gym.tap();
    await expect(page.getByRole('list', { name: 'Badge case' })).toBeVisible();
  });

  test('My House opens the Trainer Card', async ({ page }) => {
    await toMenu(page);
    const house = page.getByRole('menuitem', { name: 'My House' });
    await house.tap();
    await house.tap();
    const card = page.getByRole('dialog', { name: 'Trainer Card' });
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: 'Decks' })).toBeInViewport({ ratio: 1 });
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: 'test-results/town-trainer-card-phone.png' });
  });
});
