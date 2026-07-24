import type { Page } from '@playwright/test';

import { expect, test } from '../../fixtures';
import {
  createMarketDetail,
  createMarketSearchItem,
  createMarketSearchResponse,
  fulfillApi,
  installVendorPublicStubs,
  installVendorShellStubs,
  stubMarketDetail,
  VENDOR_EVENT_ID,
} from '../vendor-flow-helpers';

test.use({ viewport: { width: 1440, height: 900 } });

async function stubMarketSearch(page: Page): Promise<void> {
  const detail = createMarketDetail();
  await page.route('**/api/vendor/markets/search?*', (route) =>
    fulfillApi(route, createMarketSearchResponse([createMarketSearchItem(detail)])),
  );
}

async function selectDropdownOption(
  page: Page,
  title: string,
  option: string,
): Promise<void> {
  const titleElement = page
    .locator('app-dropdown .select-title')
    .filter({ hasText: new RegExp(`^${title}$`) });
  const dropdown = titleElement.locator('..');
  await dropdown.getByRole('button').click();
  await dropdown.getByRole('option', { name: option, exact: true }).click();
}

test.describe('攤主市集瀏覽', () => {
  test('@smoke VENDOR-MARKET-01／03／07 未登入可瀏覽開放活動與完整報名資訊', async ({ page }) => {
    const detail = createMarketDetail();
    await installVendorPublicStubs(page);
    await stubMarketSearch(page);
    await stubMarketDetail(page, detail);

    await page.goto('/vendor/sign-up');
    await expect(page.getByRole('heading', { name: '市集報名' })).toBeVisible();
    await expect(page.getByRole('heading', { name: detail.eventTitle })).toBeVisible();
    await expect(page.getByText('$650')).toBeVisible();

    await page.getByRole('link', { name: '查看更多' }).click();
    await expect(page).toHaveURL(new RegExp(`/vendor/sign-up-detail/${VENDOR_EVENT_ID}$`));
    await expect(page.getByRole('heading', { name: detail.eventTitle })).toBeVisible();
    await expect(page.getByText('文創手作', { exact: true })).toBeVisible();
    await expect(page.getByText('剩 8 / 20 攤')).toBeVisible();
    await expect(page.getByText('$650 / 天 / 攤')).toBeVisible();
    await expect(page.getByRole('heading', { name: '市集介紹' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '可租借設備 （每日計費）' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '額外用電 （開放申請）' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '主辦方資訊' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '交通方式' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '攤主報名流程' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '報名須知' })).toBeVisible();
    await expect(page.getByText('請依指定時間完成報到。')).toBeVisible();
    await expect(page.getByRole('button', { name: '立即報名' })).toBeVisible();

    const session = await page.evaluate(() => localStorage.getItem('MarketDayToken_vendor'));
    expect(session).toBeNull();
  });

  test('@smoke VENDOR-MARKET-01 額滿活動不可進入報名表單', async ({ page }) => {
    const detail = createMarketDetail({ registrationStatus: 'FULL' });
    await installVendorPublicStubs(page);
    await stubMarketDetail(page, detail);

    await page.goto(`/vendor/sign-up-detail/${VENDOR_EVENT_ID}`);
    const signupButton = page.getByRole('button', { name: '立即報名' });
    await expect(signupButton).toBeDisabled();
  });

  test('@smoke VENDOR-MARKET-04 搜尋條件轉成正確 query 並更新 OPEN／FULL 結果', async ({ page }) => {
    const openDetail = createMarketDetail();
    const fullDetail = createMarketDetail({
      eventId: VENDOR_EVENT_ID + 1,
      eventTitle: 'E2E 夏日手作額滿市集',
      registrationStatus: 'FULL',
    });
    const openItem = createMarketSearchItem(openDetail);
    const fullItem = createMarketSearchItem(fullDetail);

    await installVendorPublicStubs(page);
    await page.route('**/api/vendor/markets/search?*', (route) => {
      const status = new URL(route.request().url()).searchParams.get('status');
      const items = status === 'OPEN'
        ? [openItem]
        : status === 'FULL'
          ? [fullItem]
          : [openItem, fullItem];
      return fulfillApi(route, createMarketSearchResponse(items));
    });
    await page.goto('/vendor/sign-up');

    await page.getByPlaceholder('請輸入活動名稱或關鍵字').fill('夏日手作');
    await selectDropdownOption(page, '縣市', '臺北市');
    await selectDropdownOption(page, '區域', '中正區');
    const startDate = page.getByLabel('開始日期');
    const endDate = page.getByLabel('結束日期');
    await startDate.evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = '2026-08-01';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await endDate.evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = '2026-08-02';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(startDate).toHaveValue('2026-08-01');
    await expect(endDate).toHaveValue('2026-08-02');
    await selectDropdownOption(page, '活動狀態', '報名中');

    const filteredRequestPromise = page.waitForRequest((request) => {
      const params = new URL(request.url()).searchParams;
      return (
        request.method() === 'POST' &&
        request.url().includes('/api/vendor/markets/search') &&
        params.get('keyword') === '夏日手作'
      );
    });
    await page.getByRole('button', { name: '搜尋', exact: true }).click();
    const filteredRequest = await filteredRequestPromise;
    const params = new URL(filteredRequest.url()).searchParams;

    expect(params.get('city')).toBe('臺北市');
    expect(params.get('district')).toBe('中正區');
    expect(params.get('event_start_at')).toBe('2026-08-01');
    expect(params.get('event_end_at')).toBe('2026-08-02');
    expect(params.get('status')).toBe('OPEN');
    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('6');

    await expect(page.getByRole('heading', { name: openDetail.eventTitle })).toBeVisible();
    await expect(page.getByRole('heading', { name: fullDetail.eventTitle })).toHaveCount(0);

    await selectDropdownOption(page, '活動狀態', '已額滿');
    const fullRequestPromise = page.waitForRequest((request) => {
      const requestParams = new URL(request.url()).searchParams;
      return (
        request.url().includes('/api/vendor/markets/search') &&
        requestParams.get('status') === 'FULL'
      );
    });
    await page.getByRole('button', { name: '搜尋', exact: true }).click();
    await fullRequestPromise;

    await expect(page.getByRole('heading', { name: fullDetail.eventTitle })).toBeVisible();
    await expect(page.getByRole('heading', { name: openDetail.eventTitle })).toHaveCount(0);
  });

  test('@smoke VENDOR-MARKET-04 搜尋沒有符合活動時顯示查無結果', async ({ page }) => {
    const detail = createMarketDetail();
    const item = createMarketSearchItem(detail);
    await installVendorPublicStubs(page);
    await page.route('**/api/vendor/markets/search?*', (route) => {
      const keyword = new URL(route.request().url()).searchParams.get('keyword');
      const items = keyword === '完全不存在的市集' ? [] : [item];
      return fulfillApi(route, createMarketSearchResponse(items));
    });
    await page.goto('/vendor/sign-up');
    await expect(page.getByRole('heading', { name: detail.eventTitle })).toBeVisible();

    await page
      .getByPlaceholder('請輸入活動名稱或關鍵字')
      .fill('完全不存在的市集');
    const emptyRequestPromise = page.waitForRequest((request) =>
      new URL(request.url()).searchParams.get('keyword') === '完全不存在的市集',
    );
    await page.getByRole('button', { name: '搜尋', exact: true }).click();
    await emptyRequestPromise;

    await expect(page.getByText('查無符合條件的活動。')).toBeVisible();
    await expect(page.getByRole('heading', { name: detail.eventTitle })).toHaveCount(0);
  });

  test.fixme('VENDOR-MARKET-05 可依報名截止日區間篩選', async ({ page }) => {
    await installVendorPublicStubs(page);
    await stubMarketSearch(page);
    await page.goto('/vendor/sign-up');

    await expect(page.getByText('報名截止日', { exact: true })).toBeVisible();
  });

  test.fixme('VENDOR-MARKET-06 卡片使用 registrationEndAt 並顯示各場次剩餘攤位', async ({ page }) => {
    const detail = createMarketDetail();
    await installVendorPublicStubs(page);
    await page.route('**/api/vendor/markets/search?*', (route) =>
      fulfillApi(route, createMarketSearchResponse([
        {
          ...createMarketSearchItem(detail),
          dailyAvailability: detail.dailyAvailability,
        } as ReturnType<typeof createMarketSearchItem>,
      ])),
    );

    await page.goto('/vendor/sign-up');
    await expect(page.locator('.market-card .deadline')).toContainText('報名截止');
    await expect(page.getByText('08/01 剩 8 格')).toBeVisible();
    await expect(page.getByText('08/02 剩 7 格')).toBeVisible();
  });

  test.fixme('VENDOR-MARKET-07 詳情顯示後端場地須知內容', async ({ page }) => {
    const detail = createMarketDetail();
    await installVendorPublicStubs(page);
    await stubMarketDetail(page, detail);

    await page.goto(`/vendor/sign-up-detail/${VENDOR_EVENT_ID}`);
    await expect(page.getByText(detail.notice, { exact: true })).toBeVisible();
  });

  test.fixme('VENDOR-MARKET-08 需要登入或補資料時報名按鈕仍是可存取操作', async ({ page }) => {
    await installVendorPublicStubs(page);
    await stubMarketDetail(page);
    await page.goto(`/vendor/sign-up-detail/${VENDOR_EVENT_ID}`);

    const signupButton = page.getByRole('button', { name: '立即報名' });
    await expect(signupButton).toBeEnabled();
    await expect(signupButton).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('@smoke VENDOR-MARKET-08 未登入點擊立即報名會引導登入', async ({ page }) => {
    await installVendorPublicStubs(page);
    await stubMarketDetail(page);
    await page.goto(`/vendor/sign-up-detail/${VENDOR_EVENT_ID}`);

    await page.getByRole('button', { name: '立即報名' }).dispatchEvent('click');
    const dialog = page.locator('.swal2-popup');
    await expect(dialog.getByRole('heading', { name: '請先登入' })).toBeVisible();
    await dialog.getByRole('button', { name: '前往登入' }).click();
    await expect(page).toHaveURL(/\/vendor\/login$/);
  });

  test('@smoke VENDOR-MARKET-08 已登入但品牌未完成會引導設定我的攤位', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: true });
    await stubMarketDetail(page);
    await page.goto(`/vendor/sign-up-detail/${VENDOR_EVENT_ID}`);

    await page.getByRole('button', { name: '立即報名' }).dispatchEvent('click');
    const dialog = page.locator('.swal2-popup');
    await expect(dialog.getByRole('heading', { name: '請先完成攤位資料' })).toBeVisible();
    await dialog.getByRole('button', { name: '立即設定' }).click();
    await expect(page).toHaveURL(/\/vendor\/dash-board\/myStall$/);
  });

  test('@smoke VENDOR-MARKET-08 已登入且品牌完成可進入報名資料填寫', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: false });
    await stubMarketDetail(page);
    await page.goto(`/vendor/sign-up-detail/${VENDOR_EVENT_ID}`);

    await page.getByRole('button', { name: '立即報名' }).click();
    await expect(page).toHaveURL(/\/vendor\/sign-up-form$/);
    await expect(page.getByRole('heading', { name: createMarketDetail().eventTitle })).toBeVisible();
  });
});
