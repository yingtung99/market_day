import type { Page } from '@playwright/test';

import { expect, test } from '../../fixtures';
import {
  createMarketDetail,
  createMarketSearchItem,
  createMarketSearchResponse,
  fulfillApi,
  installVendorShellStubs,
  vendorUser,
} from '../vendor-flow-helpers';

test.use({ viewport: { width: 1440, height: 900 } });

async function stubHomeMarkets(page: Page): Promise<void> {
  const detail = createMarketDetail();
  await page.route('**/api/vendor/markets/search?*', (route) =>
    fulfillApi(route, createMarketSearchResponse([createMarketSearchItem(detail)], {
      pageSize: 3,
    })),
  );
}

test.describe('不需登入的攤主專區', () => {
  test('@smoke VENDOR-PORTAL-01 未登入可瀏覽首頁、報名流程與市集摘要', async ({ page }) => {
    await stubHomeMarkets(page);

    await page.goto('/vendor/home');

    await expect(page.getByRole('heading', { name: '讓好品牌， 在對的市集被看見' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '近期可報名市集' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '平台特色' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '從找市集到出攤，一站完成' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '常見問題' })).toBeVisible();
    await expect(page.getByRole('heading', { name: createMarketDetail().eventTitle })).toBeVisible();

    const session = await page.evaluate(() => ({
      token: localStorage.getItem('MarketDayToken_vendor'),
      user: localStorage.getItem('MarketDayUser_vendor'),
    }));
    expect(session).toEqual({ token: null, user: null });
  });

  test.fixme('VENDOR-PORTAL-01 首頁只請求 OPEN 可報名市集', async ({ page }) => {
    let requestedStatus: string | null = null;
    await page.route('**/api/vendor/markets/search?*', async (route) => {
      requestedStatus = new URL(route.request().url()).searchParams.get('status');
      await fulfillApi(route, createMarketSearchResponse([], { pageSize: 3 }));
    });

    await page.goto('/vendor/home');
    expect(requestedStatus).toBe('OPEN');
  });

  test('@smoke VENDOR-PORTAL-02 首頁 CTA 連到註冊與市集列表', async ({ page }) => {
    await stubHomeMarkets(page);
    await page.goto('/vendor/home');

    await expect(page.getByRole('link', { name: '立即加入攤主' })).toHaveAttribute(
      'href',
      '/vendor/register',
    );
    await expect(page.getByRole('link', { name: '查看可報名市集' })).toHaveAttribute(
      'href',
      '/vendor/sign-up',
    );
  });

  test('@smoke VENDOR-PORTAL-03 關於我們公開顯示平台理念與聯絡資訊', async ({ page }) => {
    await page.goto('/vendor/about');

    await expect(page).toHaveURL(/\/vendor\/about$/);
    await expect(page.getByRole('heading', { name: '關於小集日' })).toBeVisible();
    await expect(
      page.getByRole('complementary').getByRole('heading', { name: '聯絡我們' }),
    ).toBeVisible();
    const contactCard = page.getByRole('complementary');
    await expect(contactCard.getByText('04-22556699')).toBeVisible();
    await expect(contactCard.getByText('service@marketday.tw')).toBeVisible();
  });

  test('@smoke VENDOR-PORTAL-04 未登入導覽顯示登入註冊且不顯示帳號資訊', async ({ page }) => {
    await stubHomeMarkets(page);
    await page.goto('/vendor/home');

    const navigation = page.getByRole('navigation', { name: '攤主導覽' });
    await expect(navigation.getByRole('link', { name: '首頁', exact: true })).toBeVisible();
    await expect(navigation.getByRole('link', { name: '市集報名', exact: true })).toBeVisible();
    await expect(navigation.getByRole('link', { name: '關於我們', exact: true })).toBeVisible();

    const accountActions = page.locator('.vendor-header-actions');
    await expect(accountActions.getByRole('link', { name: '登入', exact: true })).toHaveAttribute(
      'href',
      '/vendor/login',
    );
    await expect(accountActions.getByRole('link', { name: '註冊', exact: true })).toHaveAttribute(
      'href',
      '/vendor/register',
    );
    await expect(accountActions.locator('.vendor-account-name')).toHaveCount(0);
    await expect(accountActions.getByRole('button', { name: '登出' })).toHaveCount(0);
  });

  test.fixme('VENDOR-PORTAL-04／06 未登入也顯示攤主後台入口並導向登入', async ({ page }) => {
    await stubHomeMarkets(page);
    await page.goto('/vendor/home');

    const dashboardLink = page
      .getByRole('navigation', { name: '攤主導覽' })
      .getByRole('link', { name: '攤主後台', exact: true });
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveAttribute('href', '/vendor/login');
  });

  test('@smoke VENDOR-PORTAL-05／06 已登入顯示攤主名稱、登出與後台入口', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: false });
    await stubHomeMarkets(page);
    await page.goto('/vendor/home');

    const navigation = page.getByRole('navigation', { name: '攤主導覽' });
    const dashboardLink = navigation.getByRole('link', { name: '攤主後台', exact: true });
    await expect(dashboardLink).toHaveAttribute('href', '/vendor/dash-board/home');
    await expect(dashboardLink).toHaveAttribute('target', '_blank');

    const accountActions = page.locator('.vendor-header-actions');
    await expect(accountActions.getByText(vendorUser.name, { exact: true })).toBeVisible();
    await expect(accountActions.getByRole('button', { name: '登出' })).toBeVisible();
    await expect(accountActions.getByRole('link', { name: '登入', exact: true })).toHaveCount(0);
    await expect(accountActions.getByRole('link', { name: '註冊', exact: true })).toHaveCount(0);
  });
});
