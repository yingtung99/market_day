import { expect, test } from '../../fixtures';
import { installVendorShellStubs } from '../vendor-flow-helpers';
import { vendorTestData } from '../vendor-test-data';

test.describe('攤主首次登入與品牌資料', () => {
  test('@smoke VENDOR-PROFILE-01 未完成品牌時鎖定報名功能並引導設定', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: true });
    await page.route('**/api/vendor/applications/search?*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        message: 'ok',
        messageDetails: null,
        data: {
          applications: {
            items: [], page: 1, pageSize: 6, totalItems: 0, totalPages: 0,
            hasPrevious: false, hasNext: false,
          },
        },
      }),
    }));

    await page.goto('/vendor/dash-board/home');

    const lockedRecordMenu = page.locator('button.menu-item.locked', {
      hasText: '我的報名紀錄',
    });
    await expect(lockedRecordMenu).toBeVisible();
    await expect(lockedRecordMenu).toHaveAttribute('aria-disabled', 'true');
    // 元件使用 aria-disabled 表示業務鎖定，但仍需接收點擊以顯示引導視窗。
    // 收合側欄在無 viewport 模式下可能位於畫面外，直接派送實際 DOM click。
    await lockedRecordMenu.evaluate((button: HTMLButtonElement) => button.click());

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('請先完成攤位資料');
    await expect(dialog).toContainText('我的報名紀錄');
    await dialog.getByRole('button', { name: '立即設定' }).click();

    await expect(page).toHaveURL(/\/vendor\/dash-board\/myStall$/);
    await expect(page.getByRole('heading', { name: '我的攤位' })).toBeVisible();
  });

  test('@smoke VENDOR-PROFILE-02 必填品牌資料未完成時不可儲存', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: true });
    await page.goto('/vendor/dash-board/myStall');
    await expect(page.getByRole('heading', { name: '我的攤位' })).toBeVisible();

    await page.locator('form.stall-form').evaluate((form: HTMLFormElement) => {
      form.noValidate = true;
    });
    await page.getByRole('button', { name: '儲存變更' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('必填資料尚未完成');
    await expect(dialog).toContainText('品牌名稱');
    await expect(dialog).toContainText('聯絡電話');
    await expect(dialog).toContainText('品牌封面');
    await expect(page.locator('[data-invalid="true"]')).not.toHaveCount(0);
  });

  test('@smoke VENDOR-PROFILE-03 品牌封面拒絕錯誤格式及超過 5MB', async ({ page }) => {
    await installVendorShellStubs(page, { needsProfile: true });
    await page.goto('/vendor/dash-board/myStall');

    const coverInput = page.getByLabel('上傳品牌封面').locator('input[type="file"]');
    await coverInput.setInputFiles(vendorTestData.profile.invalidImagePath);
    await expect(page.getByRole('dialog')).toContainText('圖片格式不符');
    await page.getByRole('dialog').getByRole('button', { name: '確定' }).click();

    await coverInput.setInputFiles(vendorTestData.profile.coverPath);
    await expect(page.getByRole('dialog')).toContainText('圖片檔案過大');
    await expect(page.getByRole('dialog')).toContainText('不可超過 5MB');
  });

  test.fixme(
    'VENDOR-PROFILE-05 後台可保存多筆商品且前台最多顯示 3 筆代表商品',
    async () => {
      // 目前 VendorDashboardStall.maxProducts 直接限制為 3，與「後台可新增多筆」需求不符。
    },
  );
});
