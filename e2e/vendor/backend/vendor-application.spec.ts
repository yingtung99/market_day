import { expect, test } from '../../fixtures';
import {
  apiResult,
  createMarketDetail,
  installVendorShellStubs,
  stubMarketDetail,
  VENDOR_APPLICATION_ID,
  VENDOR_APPLICATION_NO,
  VENDOR_EVENT_ID,
} from '../vendor-flow-helpers';

async function openApplicationForm(page: import('@playwright/test').Page): Promise<void> {
  await installVendorShellStubs(page, { needsProfile: false });
  await stubMarketDetail(page, createMarketDetail());
  await page.goto(`/vendor/sign-up-detail/${VENDOR_EVENT_ID}`);
  await page.getByRole('button', { name: '立即報名' }).click();
  await expect(page).toHaveURL(/\/vendor\/sign-up-form$/);
}

test.describe('攤主報名資料', () => {
  test('@smoke VENDOR-APP-01 必填日期、用電及車牌驗證會阻擋下一步', async ({ page }) => {
    await openApplicationForm(page);

    const dateInputs = page.locator('.date-option input[type="checkbox"]');
    await dateInputs.first().uncheck();
    await dateInputs.nth(1).uncheck();
    await page.getByRole('button', { name: /下一步，確認資料/ }).click();

    await expect(page.getByText('請至少選擇一個活動日期。')).toBeVisible();
    await expect(page.getByText('請至少選擇一個額外用電規格。')).toBeVisible();
    await expect(page.getByText('有車輛進場時，請填寫車牌號碼。')).toBeVisible();
    await expect(page).toHaveURL(/\/vendor\/sign-up-form$/);
  });

  test('@smoke VENDOR-APP-02 確認報名資料並送出正確 payload', async ({ page }) => {
    await openApplicationForm(page);

    // 從詳情頁進入時所有可報名日期預設勾選；此案例只保留第一天。
    await page.locator('.date-option input[type="checkbox"]').nth(1).uncheck();
    await page.locator('.equipment-row input[type="checkbox"]').first().check();
    await page.locator('.power-options input[type="checkbox"]').first().check();
    await page.getByPlaceholder('請輸入車牌號碼（範例：ABC-1234）').fill('abc-1234');
    await page.getByPlaceholder('請輸入內容（選填）').fill('靠近入口的位置');
    await page.getByRole('button', { name: /下一步，確認資料/ }).click();

    await expect(page).toHaveURL(/\/vendor\/sign-up-confirm$/);
    await expect(page.getByLabel('報名進度').getByText('確認資料')).toBeVisible();
    await expect(page.getByText('展示桌', { exact: true })).toBeVisible();
    await expect(page.getByText('ABC-1234', { exact: true })).toBeVisible();
    await expect(page.getByText('靠近入口的位置', { exact: true })).toBeVisible();

    let requestBody: Record<string, unknown> | undefined;
    await page.route('**/api/vendor/applications', async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiResult({
          applicationId: VENDOR_APPLICATION_ID,
          applicationNo: VENDOR_APPLICATION_NO,
          eventId: VENDOR_EVENT_ID,
          eventTitle: 'E2E 夏日手作市集',
          applicationStatus: '待審核',
          reviewStatus: 'PENDING',
          paymentStatus: 'PENDING',
          applyDates: ['2026-08-01'],
          applicationFee: 650,
          equipmentTotal: 400,
          depositAmount: 1000,
          totalAmount: 2050,
          paymentDueAt: '2026-07-25T23:59:00',
          equipmentRentals: [],
        })),
      });
    });

    await page.locator('label.agreement input[type="checkbox"]').check();
    await page.getByRole('button', { name: '確認送出報名申請' }).click();

    await expect(page).toHaveURL(/\/vendor\/sign-up-complete$/);
    await expect(page.getByRole('heading', { name: '您已成功送出報名申請！' })).toBeVisible();
    await expect(page.getByText(VENDOR_APPLICATION_NO, { exact: true })).toBeVisible();
    expect(requestBody).toEqual({
      eventId: VENDOR_EVENT_ID,
      applyDates: ['2026-08-01'],
      vehicleNo: 'ABC-1234',
      applicantNote: '靠近入口的位置',
      equipmentRentals: [
        { eventEquipmentId: 11, quantity: 1, rentalUnits: 1 },
        { eventEquipmentId: 21, quantity: 1, rentalUnits: 1 },
      ],
    });
  });

  test.fixme('VENDOR-APP-01 報名表單必須選擇攤位類型並送出對應欄位', async () => {
    // VendorApplicationSubmitRequest 目前沒有攤位類型欄位，UI 也沒有選項。
  });
});
