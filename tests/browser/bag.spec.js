import { test, expect } from '@playwright/test';

test('bag quantities survive refresh and removal stays removed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/collection');
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await page.locator('.product-card').first().locator('a').first().click();
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('link', { name: 'Shopping bag, 1 items' }).click();
  await page.getByRole('button', { name: /Increase .* quantity/ }).click();
  await expect(page.locator('.quantity-control output')).toHaveText('2');
  const retryKey = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem('verse_bag')).checkoutKey,
  );
  await page.reload();
  await expect(page.locator('.bag-item')).toHaveCount(1);
  await expect(page.locator('.quantity-control output')).toHaveText('2');
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem('verse_bag')).checkoutKey),
  ).toBe(retryKey);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.reload();
  await expect(page.locator('.bag-item')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Shopping bag, 0 items' })).toBeVisible();
});

test('invalid saved bag entries cannot break checkout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'verse_bag',
      JSON.stringify({
        items: [[999999, 1], [1, -2], [1, '3'], null],
        checkoutKey: 'bad',
      }),
    );
  });
  await page.goto('/checkout');
  await expect(page.locator('h1')).toContainText('The bag.');
  await expect(page.getByRole('link', { name: 'Shopping bag, 0 items' })).toBeVisible();
});

test('shopping works when session storage is unavailable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new Error('Storage unavailable');
      },
    });
  });
  await page.goto('/collection');
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await page.locator('.product-card').first().locator('a').first().click();
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('link', { name: 'Shopping bag, 1 items' }).click();
  await expect(page.locator('.bag-item')).toHaveCount(1);
});
