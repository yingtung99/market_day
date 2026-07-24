import { expect, test } from '../../fixtures';
import { fulfillApi, installVendorShellStubs } from '../vendor-flow-helpers';

test.describe('攤主退款資格（不測實際退款交易）', () => {
  test('@smoke VENDOR-REFUND-02 報名完成清單不提供退款入口', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: false });
    await page.route('**/api/vendor/applications/search?*', (route) => fulfillApi(route, {
      totalCount: 1,
      applications: {
        items: [{
          applicationId: 41,
          applicationNo: 'MD-E2E-00041',
          appliedAt: '2026-07-10T10:00:00',
          applicationStatus: '報名完成',
          eventId: 141,
          eventImageUrl: null,
          eventTitle: '完成選位不可退款市集',
          eventDate: '2026/08/01',
          eventStartAt: '2026-08-01T10:00:00',
          eventEndAt: '2026-08-01T18:00:00',
          location: '臺北市中正區',
        }],
        page: 1,
        pageSize: 6,
        totalItems: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      },
    }));

    await page.goto('/vendor/dash-board/application-record');
    const row = page.locator('tbody tr').filter({ hasText: '完成選位不可退款市集' });
    await expect(row.getByRole('link', { name: '退款申請' })).toHaveCount(0);
    await expect(row.getByRole('link', { name: '查看' })).toBeVisible();
  });

  test.fixme('VENDOR-REFUND-02 報名完成詳情頁也不得顯示退款入口', async () => {
    // 目前詳情頁仍可能在報名完成狀態建立退款按鈕，需先修正產品程式。
  });

  test.skip('VENDOR-REFUND-01／03～06 Real API 退款資格與狀態生命週期', async () => {
    // 需要可推進退款狀態、控制報名截止時間及還原名額的 fixture；不呼叫第三方金流。
  });
});
