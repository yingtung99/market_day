import { expect, test } from '../../fixtures';
import {
  apiResult,
  createApplicationDetail,
  createMarketDetail,
  createStallMap,
  fulfillApi,
  installVendorShellStubs,
  stubApplicationDetail,
  stubMarketDetail,
  VENDOR_APPLICATION_ID,
  VENDOR_APPLICATION_NO,
} from '../vendor-flow-helpers';
import { vendorTestData } from '../vendor-test-data';

async function openBoothPage(page: import('@playwright/test').Page): Promise<void> {
  const { available, occupied } = vendorTestData.booth;
  await installVendorShellStubs(page, { needsProfile: false });
  await stubApplicationDetail(page, createApplicationDetail('待選位'));
  await stubMarketDetail(page, createMarketDetail({
    dailyAvailability: [{
      applyDate: vendorTestData.application.applyDate,
      totalStalls: 2,
      remainingStalls: 1,
    }],
  }));
  await page.route(`**/api/vendor/stall-map/${VENDOR_APPLICATION_NO}?*`, (route) => {
    return fulfillApi(route, createStallMap(false));
  });
  const stallMapResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/vendor/stall-map/${VENDOR_APPLICATION_NO}`) &&
      response.request().method() === 'GET',
  );
  await page.goto(
    `/vendor/dash-board/application-record/detail/${VENDOR_APPLICATION_NO}/booth?applicationId=${VENDOR_APPLICATION_ID}`,
  );
  expect((await stallMapResponse).ok()).toBe(true);
  await expect(page.getByRole('heading', { name: '攤位選擇' })).toBeVisible();
  await expect(page.locator(`#market-booth-${available.stallNo}`)).toHaveClass(/booth-available/, {
    timeout: 15_000,
  });
}

test.describe('攤主互動式選位', () => {
  test('@smoke VENDOR-BOOTH-02／04 地圖區分可選及已占用攤位', async ({ page }) => {
    await openBoothPage(page);
    const { available: availableData, occupied: occupiedData } = vendorTestData.booth;

    const available = page.locator(`#market-booth-${availableData.stallNo}`);
    const occupied = page.locator(`#market-booth-${occupiedData.stallNo}`);
    await expect(available).toHaveClass(/booth-available/);
    await expect(occupied).toHaveClass(/booth-occupied/);

    await occupied.click();
    await expect(page.getByText(occupiedData.stallNo, { exact: true })).toHaveCount(1);

    await available.click();
    await expect(available).toHaveClass(/booth-selected/);
    await expect(page.getByRole('button', { name: '完成攤位選擇' })).toBeEnabled();
  });

  test('@smoke VENDOR-BOOTH-05 攤位被搶先選走時提示並引導重新選擇', async ({ page }) => {
    await openBoothPage(page);
    await page.locator(`#market-booth-${vendorTestData.booth.available.stallNo}`).click();

    await page.route('**/api/stalls/select', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiResult(null, {
        statusCode: 409,
        message: vendorTestData.booth.conflictMessage,
      })),
    }));

    await page.getByRole('button', { name: '完成攤位選擇' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '確認完成選位' }).click();
    await expect(page.getByRole('dialog')).toContainText('已被其他攤主完成選位');
    await expect(page.getByRole('dialog').getByRole('button', { name: '重新選擇攤位' })).toBeVisible();
  });

  test.skip('VENDOR-BOOTH-01 未付款直接呼叫選位 API 會被後端拒絕', async () => {
    // 需要 Real API 權限與狀態 fixture，UI 隱藏入口不足以證明規則。
  });
});
