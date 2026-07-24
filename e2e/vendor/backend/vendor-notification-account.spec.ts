import { expect, test } from '../../fixtures';
import { fulfillApi, installVendorShellStubs, vendorUser } from '../vendor-flow-helpers';
import { vendorTestData } from '../vendor-test-data';

const notices = Object.values(vendorTestData.notification);

test.describe('攤主通知中心與帳號限制', () => {
  test('@smoke VENDOR-NOTIFY-01／02 通知可分類並標示已讀', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: false });
    const requestedFilters: string[] = [];
    let markedReadId: number | null = null;

    await page.route('**/api/vendor/notices?*', async (route) => {
      const filter = new URL(route.request().url()).searchParams.get('filter') ?? '全部';
      requestedFilters.push(filter);
      const items = filter === '付款相關'
        ? notices.filter((notice) => notice.category === '付款相關')
        : notices;
      await fulfillApi(route, {
        unreadCount: items.filter((notice) => !notice.isRead).length,
        notifications: {
          items,
          page: 1,
          pageSize: 8,
          totalItems: items.length,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
        },
      });
    });
    await page.route('**/api/notification/*/isRead', async (route) => {
      const match = route.request().url().match(/notification\/(\d+)\/isRead/);
      markedReadId = Number(match?.[1]);
      await fulfillApi(route, { id: markedReadId, isRead: true });
    });

    await page.goto('/vendor/dash-board/notification');
    await expect(page.getByRole('heading', { name: '通知中心' })).toBeVisible();
    await expect(page.getByText('您的市集報名已審核通過')).toBeVisible();
    await expect(page.getByText('已確認收到您的報名費用')).toBeVisible();
    await expect(page.getByText('攤位地圖已開放選位')).toBeVisible();
    await expect(page.getByText('活動入場時間已更新')).toBeVisible();

    await page.locator('.tabs').getByRole('button', { name: '付款相關' }).click();
    await expect(page.getByText('已確認收到您的報名費用')).toBeVisible();
    await expect(page.getByText('您的市集報名已審核通過')).toHaveCount(0);

    const paymentCard = page.locator('.notification-card', {
      hasText: '已確認收到您的報名費用',
    });
    await expect(paymentCard).toHaveClass(/unread/);
    await paymentCard.click();
    await expect(paymentCard).not.toHaveClass(/unread/);
    expect(markedReadId).toBe(72);
    expect(requestedFilters).toContain('付款相關');
  });

  test('@smoke VENDOR-ACCOUNT-02 有進行中流程時註銷失敗並保留 Session', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: false });
    let deactivateRequested = false;
    await page.route('**/api/account/deactivate', async (route) => {
      deactivateRequested = true;
      await fulfillApi(route, null, {
        statusCode: 409,
        message: '尚有進行中的報名、待付款或未完成活動，無法註銷帳號',
      });
    });

    await page.goto('/vendor/dash-board/account-settings');
    await expect(page.getByRole('heading', { name: '帳號設定' })).toBeVisible();
    await expect(page.locator('.account-modal').getByText(vendorUser.email, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '申請註銷帳號' }).click();

    const alert = page.locator('.swal2-popup');
    await expect(alert).toContainText('註銷帳號確認');
    await alert.getByRole('button', { name: '確定註銷' }).click();
    await expect(alert).toContainText('目前無法註銷帳號');
    await expect(alert).toContainText('尚有進行中的報名');
    expect(deactivateRequested).toBe(true);

    const session = await page.evaluate(() => ({
      token: localStorage.getItem('MarketDayToken_vendor'),
      user: localStorage.getItem('MarketDayUser_vendor'),
    }));
    expect(session.token).toBeTruthy();
    expect(session.user).toContain(vendorUser.email);
  });

  test.skip('VENDOR-NOTIFY-04 登入中即時收到新通知', async () => {
    // 需先確認正式通知通道為 WebSocket、SSE 或輪詢。
  });

  test.skip('VENDOR-ACCOUNT-03 無進行中流程的一次性帳號可註銷', async () => {
    // 由既有 AUTH-10 destructive 測試負責，不能使用一般 Vendor Smoke 帳號。
  });
});
