import { expect, test } from '../../fixtures';
import {
  createApplicationDetail,
  fulfillApi,
  installVendorShellStubs,
  stubApplicationDetail,
  VENDOR_APPLICATION_ID,
  VENDOR_APPLICATION_NO,
} from '../vendor-flow-helpers';
import { vendorTestData } from '../vendor-test-data';

test.describe('攤主付款狀態（不測第三方金流）', () => {
  test('@smoke VENDOR-PAY-01 待付款頁顯示後端核定金額與期限', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: false });
    const detail = createApplicationDetail('待付款');
    await stubApplicationDetail(page, detail);
    await page.route(
      `**/api/vendor/payments/${VENDOR_APPLICATION_NO}/status`,
      (route) => fulfillApi(route, {
        applicationId: VENDOR_APPLICATION_ID,
        applicationNo: VENDOR_APPLICATION_NO,
        reviewStatus: 'APPROVED',
        applicationPaymentStatus: 'PENDING',
        cancelled: false,
        applicationAmount: vendorTestData.fees.baseTotal,
        paymentDueAt: vendorTestData.payment.deadlineAt,
        paymentId: null,
        paymentNo: null,
        merchantOrderNo: null,
        paymentAmount: null,
        provider: null,
        providerTradeNo: null,
        paymentRecordStatus: 'PENDING',
        paidAt: null,
        paymentCreatedAt: null,
      }),
    );

    let paymentCreationRequested = false;
    await page.route('**/api/vendor/payments/newebpay', async (route) => {
      paymentCreationRequested = true;
      await route.abort();
    });

    await page.goto(
      `/vendor/dash-board/application-record/detail/${VENDOR_APPLICATION_NO}/payment?applicationId=${VENDOR_APPLICATION_ID}`,
    );

    await expect(page.getByRole('heading', { name: '付款頁面' })).toBeVisible();
    await expect(page.getByText(VENDOR_APPLICATION_NO, { exact: true })).toBeVisible();
    await expect(page.getByText('待付款', { exact: true })).toBeVisible();
    await expect(page.getByText(`$${vendorTestData.fees.baseTotal.toLocaleString()}`)).toHaveCount(2);
    await expect(page.getByText(/2026\/7\/25 23:59:00/)).toBeVisible();
    expect(paymentCreationRequested).toBe(false);
  });

  test.skip('VENDOR-PAY-02 已付款 fixture 顯示待選位並開放地圖', async () => {
    // 需要後端 fixture 建立已付款紀錄；本階段不測付款交易、callback 或 webhook。
  });
});
