import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('public storefront has no detected WCAG A/AA violations on desktop and mobile', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Reject optional' }).click();
  const products = await page.request.get('/api/products').then((r) => r.json());
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/collection',
      `/watches/${products[0].slug}`,
      '/stores',
      '/policies/privacy',
      '/policies/terms',
      '/account',
      '/bag',
    ]) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        `${width}px ${route}`,
      ).toEqual([]);
    }
  }
});
