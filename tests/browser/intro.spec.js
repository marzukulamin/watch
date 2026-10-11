import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('local Omni video entrance, identity, assembly, outlet, logo and continuous exit', async ({
  page,
}) => {
  const errors = [],
    external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:3000') &&
      !r.url().startsWith('data:') &&
      !r.url().startsWith('blob:')
    )
      external.push(r.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'VERSE cinematic introduction' })).toBeVisible();
  await expect(page.locator('.cinematic-intro')).toHaveAttribute('data-phase', 'identity');
  await expect(page.locator('.intro-video')).toBeVisible();
  await expect(page.locator('.intro-stage video')).toHaveAttribute('src', /desktop.v2.mp4/);
  await expect(page.locator('.cinematic-intro')).toHaveAttribute('data-phase', 'assembly', {
    timeout: 8000,
  });
  await page.getByRole('button', { name: 'Pause intro', exact: true }).click();
  await page.screenshot({ path: 'docs/reference/intro-desktop-assembly.png' });
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('button', { name: 'Resume intro', exact: true }).click();
  await expect(page.locator('.cinematic-intro')).toHaveAttribute('data-phase', 'outlet', {
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Pause intro', exact: true }).click();
  await page.screenshot({ path: 'docs/reference/intro-desktop-outlet.png' });
  await page.getByRole('button', { name: 'Resume intro', exact: true }).click();
  await expect(page.locator('.cinematic-intro')).toHaveAttribute('data-phase', 'reveal', {
    timeout: 10000,
  });
  await expect
    .poll(() =>
      page.locator('.intro-finale').evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(1);
  await page.getByRole('button', { name: 'Pause intro', exact: true }).click();
  await page.screenshot({ path: 'docs/reference/intro-desktop-reveal.png' });
  await page.getByRole('button', { name: 'Resume intro', exact: true }).click();
  await expect(page.locator('.cinematic-intro')).toHaveCount(0, { timeout: 7000 });
  await expect(page.locator('#app')).not.toHaveAttribute('inert');
  await expect(page.locator('.scene-ready')).toBeVisible();
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await page.getByRole('link', { name: 'Find your timepiece', exact: true }).click();
  await expect(page).toHaveURL(/collection/);
  await expect(page.locator('.cinematic-intro')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('mobile, keyboard focus, skip, replay and session reload', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('.intro-video')).toBeVisible();
  await expect(page.locator('.intro-stage video')).toHaveAttribute('src', /mobile.v2.mp4/);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBeTruthy();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Pause intro' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Skip intro/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.cinematic-intro')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await page.getByRole('button', { name: 'Replay intro' }).click();
  await expect(page.locator('.cinematic-intro')).toHaveAttribute('data-phase', 'reveal', {
    timeout: 25000,
  });
  await expect
    .poll(() =>
      page.locator('.intro-finale').evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(1);
  await page.getByRole('button', { name: 'Pause intro', exact: true }).click();
  await page.screenshot({ path: 'docs/reference/intro-mobile-reveal.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.cinematic-intro')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replay intro' })).toBeFocused();
  await page.reload();
  await expect(page.locator('h1')).toContainText('A different');
  await expect(page.locator('.cinematic-intro')).toHaveCount(0);
});
test('video failure uses the local assembly; WebGL failure gives usable static fallback', async ({
  page,
}) => {
  await page.route('**/media/intro/manifest.json', (r) =>
    r.fulfill({
      json: {
        inspected: true,
        desktop: '/media/intro/missing.mp4',
        mobile: '/media/intro/missing.mp4',
      },
    }),
  );
  await page.route('**/media/intro/missing.mp4', (r) => r.abort());
  await page.goto('/');
  await expect(page.locator('.intro-webgl')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.cinematic-intro')).toHaveCount(0);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.includes('webgl') ? null : original.call(this, type, ...args);
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await page.getByRole('button', { name: 'Replay intro' }).click();
  await expect(page.getByRole('dialog', { name: 'VERSE cinematic introduction' })).toBeVisible();
  await expect(page.locator('.intro-static')).toBeVisible();
  await page.getByRole('button', { name: /Skip intro/ }).click();
  await expect(page.locator('.cinematic-intro')).toHaveCount(0);
  await expect(page.locator('h1')).toContainText('A different');
});
test('reduced motion and direct product navigation remain uninterrupted', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('A different');
  await expect(page.locator('.cinematic-intro')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replay intro' })).toBeDisabled();
  await expect(page.locator('.cinematic-intro')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/collection');
  await expect(page.locator('.product-card')).toHaveCount(19);
  await expect(page.locator('.cinematic-intro')).toHaveCount(0);
});
