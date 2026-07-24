import type { Page } from '@playwright/test';

import { expect, test } from '../../fixtures';
import {
  createMarketDetail,
  createMarketSearchItem,
  createMarketSearchResponse,
  fulfillApi,
  installVendorPublicStubs,
  stubMarketDetail,
  VENDOR_EVENT_ID,
} from '../vendor-flow-helpers';

const responsiveViewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

async function installResponsivePageStubs(page: Page): Promise<void> {
  const detail = createMarketDetail();
  await installVendorPublicStubs(page);
  await page.route('**/api/vendor/markets/search?*', (route) =>
    fulfillApi(route, createMarketSearchResponse([createMarketSearchItem(detail)])),
  );
  await stubMarketDetail(page, detail);
}

async function expectNoHorizontalOverflow(
  page: Page,
  path: string,
  viewportWidth: number,
): Promise<void> {
  await expect.poll(
    async () => page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    {
      message: `${path} 在 ${viewportWidth}px 不應產生水平捲軸`,
    },
  ).toBe(true);
}

test.describe('攤主公開專區 RWD', () => {
  test('@smoke @vendor-portal VENDOR-RWD-01 手機導覽可由按鈕、背景、Escape 與路由切換收合', async ({ page }) => {
    await installResponsivePageStubs(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/vendor/home');

    const menuButton = page.getByRole('button', { name: '開啟攤主導覽選單' });
    const drawer = page.locator('#vendor-mobile-menu');
    const backdrop = page.locator('.vendor-menu-backdrop');

    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(drawer).toHaveClass(/open/);

    await drawer.getByRole('button', { name: '關閉攤主導覽選單' }).click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await menuButton.click();
    await expect(backdrop).toHaveClass(/open/);
    await expect(backdrop).toBeVisible();
    await backdrop.click({ position: { x: 380, y: 400 } });
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await menuButton.click();
    await page.keyboard.press('Escape');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await menuButton.click();
    await drawer.getByRole('link', { name: '關於我們', exact: true }).click();
    await expect(page).toHaveURL(/\/vendor\/about$/);
    await expect(page.locator('#vendor-mobile-menu')).toHaveAttribute('aria-hidden', 'true');
  });

  test('@smoke @vendor-portal VENDOR-RWD-02 公開頁在桌面、平板及手機沒有水平溢位', async ({ page }) => {
    await installResponsivePageStubs(page);
    const paths = [
      '/vendor/home',
      '/vendor/about',
      '/vendor/sign-up',
      `/vendor/sign-up-detail/${VENDOR_EVENT_ID}`,
    ];

    for (const viewport of responsiveViewports) {
      await page.setViewportSize(viewport);

      for (const path of paths) {
        await page.goto(path);
        await expect(page.locator('.vendor-header')).toBeVisible();
        await expect(page.locator('app-user-footer footer')).toBeVisible();
        await expectNoHorizontalOverflow(page, path, viewport.width);
      }
    }
  });
});
