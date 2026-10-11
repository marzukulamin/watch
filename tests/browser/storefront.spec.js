import { test, expect } from '@playwright/test';
test('desktop storefront, real catalogue, policies and bag', async ({ page }) => {
  const errors = [],
    external = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('request', (req) => {
    if (
      !req.url().startsWith('http://127.0.0.1:3000') &&
      !req.url().startsWith('data:') &&
      !req.url().startsWith('blob:')
    )
      external.push(req.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: /Skip intro/ }).click();
  await expect(page.locator('h1')).toContainText('A different');
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await expect(page.locator('.scene-ready')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-lazy-video]')).not.toHaveAttribute('src');
  await page.screenshot({ path: 'docs/reference/desktop-home.png' });
  await page.getByRole('link', { name: 'Find your timepiece', exact: true }).click();
  await expect(page).toHaveURL(/collection/);
  await expect(page.locator('.product-card')).toHaveCount(19);
  await page.getByLabel('Brand', { exact: true }).selectOption('Timex');
  await expect(page.locator('.product-card')).toHaveCount(4);
  await page.locator('.product-card').first().locator('a').first().click();
  await expect(page.locator('h1')).toContainText('Marlin');
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('link', { name: /Shopping bag, 1 items/ }).click();
  await expect(page.locator('.bag-item')).toHaveCount(1);
  await page.getByRole('link', { name: 'Privacy policy', exact: true }).click();
  await expect(page.locator('h1')).toContainText('Privacy policy');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('mobile layout and navigation at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: /Skip intro/ }).click();
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await expect(page.locator('.scene-ready')).toBeVisible({ timeout: 15000 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBeTruthy();
  await page.screenshot({ path: 'docs/reference/mobile-home.png' });
  await page.locator('#the-edit').scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator('#the-edit .product-card')
        .first()
        .evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe('1');
  await page.screenshot({ path: 'docs/reference/mobile-edit.png' });
  await page.locator('#perspective').scrollIntoViewIfNeeded();
  await expect(page.locator('.perspective-photo video')).toBeVisible();
  await page.screenshot({ path: 'docs/reference/mobile-perspective.png' });
  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'The collection' })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(19);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBeTruthy();
  await page.screenshot({ path: 'docs/reference/mobile-collection.png' });
  await page.locator('.product-card').first().locator('a').first().click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBeTruthy();
});
test('consent, reduced motion and role authorization', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reject optional' })).toBeVisible();
  await page.getByRole('button', { name: 'Reject optional' }).click();
  const s = await page.request.get('/api/session').then((r) => r.json());
  expect(s.analytics_consent).toBe(false);
  expect(
    (
      await page.request.post('/api/analytics/view', {
        headers: { 'X-CSRF-Token': s.csrf },
        data: { route: 'home' },
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.get('/api/admin/overview')).status()).toBe(403);
  expect((await page.request.post('/api/auth/register', { data: {} })).status()).toBe(403);
  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await page.getByRole('button', { name: 'Accept analytics' }).click();
  const accepted = await page.request.get('/api/session').then((r) => r.json());
  expect(accepted.analytics_consent).toBe(true);
  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await page.goto('/stores');
  await expect(page.locator('h1')).toContainText('Meet VERSE');
  await expect(page.locator('.ribbon-track')).toHaveCount(0);
});
