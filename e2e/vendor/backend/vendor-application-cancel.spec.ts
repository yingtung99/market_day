import { expect, test } from '../../fixtures';
import { fulfillApi, installVendorShellStubs } from '../vendor-flow-helpers';

const applicationRows = [
  { id: 31, no: 'MD-E2E-00031', status: '待審核', title: '待審核測試市集' },
  { id: 32, no: 'MD-E2E-00032', status: '待付款', title: '待付款測試市集' },
  { id: 33, no: 'MD-E2E-00033', status: '報名完成', title: '完成報名測試市集' },
];

test.describe('攤主取消報名', () => {
  test('@smoke VENDOR-CANCEL-03 只有待審核與待付款提供取消入口', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: false });
    await page.route('**/api/vendor/applications/search?*', (route) => fulfillApi(route, {
      totalCount: applicationRows.length,
      applications: {
        items: applicationRows.map((item) => ({
          applicationId: item.id,
          applicationNo: item.no,
          appliedAt: '2026-07-10T10:00:00',
          applicationStatus: item.status,
          eventId: 100 + item.id,
          eventImageUrl: null,
          eventTitle: item.title,
          eventDate: '2026/08/01 - 2026/08/02',
          eventStartAt: '2026-08-01T10:00:00',
          eventEndAt: '2026-08-02T18:00:00',
          location: '臺北市中正區',
        })),
        page: 1,
        pageSize: 6,
        totalItems: applicationRows.length,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      },
    }));

    await page.goto('/vendor/dash-board/application-record');
    await expect(page.getByRole('heading', { name: '我的報名紀錄' })).toBeVisible();

    // ClickableTableRowDirective 會把 tr 的 ARIA role 改為 link，因此以實際 tr 範圍查找。
    const reviewingRow = page.locator('tbody tr').filter({ hasText: '待審核測試市集' });
    const paymentRow = page.locator('tbody tr').filter({ hasText: '待付款測試市集' });
    const completedRow = page.locator('tbody tr').filter({ hasText: '完成報名測試市集' });

    await expect(reviewingRow.getByRole('link', { name: '取消報名' })).toBeVisible();
    await expect(paymentRow.getByRole('link', { name: '取消報名' })).toBeVisible();
    await expect(completedRow.getByRole('link', { name: '取消報名' })).toHaveCount(0);
    await expect(completedRow.getByRole('link', { name: '查看' })).toBeVisible();
  });

  test.skip('VENDOR-CANCEL-01／02 Real API 取消後狀態更新並釋放名額', async () => {
    // 需要可建立待審核／待付款報名並能查詢、還原名額的 E2E fixture。
  });

  test.skip('VENDOR-PAY-03 付款逾期先標示已逾期再自動取消', async () => {
    // 需要測試時鐘或可安全觸發逾期排程的 E2E fixture。
  });
});
