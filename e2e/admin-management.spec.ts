import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { Locator, Page, Response } from '@playwright/test';
import { expect, test } from './fixtures';
import { authRoleCases, getCredentials, loginWithUi } from './auth-test-helpers';

interface ApiEnvelope<T = Record<string, unknown>> {
  statusCode?: number;
  message?: string;
  data?: T;
}

interface TargetCredentials {
  email: string;
  password: string;
}

interface AdminFlowCredentials {
  admin: TargetCredentials;
  organizer: TargetCredentials;
  targetOrganizer: TargetCredentials;
  targetVendor: TargetCredentials;
}

interface AdminFlowState {
  eventAId: number;
  targetOrganizerUserId: number;
  targetVendorUserId: number;
}

interface EventTimes {
  registrationStartsAt: Date;
  registrationEndsAt: Date;
  eventStartsAt: Date;
  eventEndsAt: Date;
}

const eventCoverPath = resolve('src/assets/images/market/cards/market-card-01.png');
const eventMapPath = resolve('src/assets/images/market/cards/market-card-02.png');

test.describe('Market Day 管理員後台', () => {
  test('@admin-management 管理員後台補件、下架審核、使用者管理與操作紀錄', async ({ browser }) => {
    test.setTimeout(10 * 60 * 1000);

    const credentials = requiredCredentials();
    test.skip(!credentials, '需要管理員、主辦方、目標主辦方與目標攤主四組 E2E 測試帳號。');

    const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const eventAName = `E2E 管理員測試活動A ${runId}`;

    const desktopViewport = { width: 1440, height: 900 };
    const adminContext = await browser.newContext({ viewport: desktopViewport });
    const organizerContext = await browser.newContext({ viewport: desktopViewport });
    const targetOrganizerContext = await browser.newContext({ viewport: desktopViewport });
    const targetVendorContext = await browser.newContext({ viewport: desktopViewport });

    const adminPage = await adminContext.newPage();
    const organizerPage = await organizerContext.newPage();
    const targetOrganizerPage = await targetOrganizerContext.newPage();
    const targetVendorPage = await targetVendorContext.newPage();

    for (const page of [adminPage, organizerPage, targetOrganizerPage, targetVendorPage]) {
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(30_000);
    }

    const state: AdminFlowState = {
      eventAId: 0,
      targetOrganizerUserId: 0,
      targetVendorUserId: 0,
    };

    try {
      await test.step('ADMIN-01～04 管理員登入、總覽、通知中心', async () => {
        progress('ADMIN-01～04 登入、總覽、通知中心');
        const adminConfig = authRoleCases.find((item) => item.role === 'admin')!;
        const loginResponse = await loginWithUi(
          adminPage,
          adminConfig,
          credentials!.admin.email,
          credentials!.admin.password,
        );
        const loginBody = await expectApiSuccess<{ user?: { role?: string } }>(loginResponse);
        expect(loginBody.data?.user?.role).toBe('ADMIN');
        await expect(adminPage).toHaveURL(adminConfig.dashboardPath);

        const overviewPromise = waitForApi(adminPage, '/api/admin/dashboard/overview', 'GET');
        await adminPage.goto('/admin/dash-board/home');
        const overviewBody = await expectApiSuccess<{
          pendingReview?: number;
          totalActivity?: number;
        }>(await overviewPromise);
        expect(overviewBody.data?.totalActivity).toBeGreaterThanOrEqual(0);
        await expect(adminPage.locator('.todo-card', { hasText: '活動審核' })).toBeVisible();
        await expect(adminPage.locator('.stats-cards .todo-card', { hasText: '活動總數' })).toBeVisible();

        await adminPage.goto('/admin/dash-board/notification');
        await expect(adminPage.getByRole('heading', { name: '通知中心' })).toBeVisible();
        for (const tab of ['未讀', '活動', '系統', '異常', '全部'] as const) {
          const noticesPromise = waitForApi(adminPage, '/api/admin/notices/search', 'POST');
          await adminPage.locator('.tabs button', { hasText: tab }).click();
          await expectApiSuccess(await noticesPromise);
        }

        const unreadCard = adminPage.locator('.notification-card.unread').first();
        if (await unreadCard.count() > 0) {
          const markedTitle = (await unreadCard.locator('.notification-content h3').textContent())?.trim() ?? '';
          const markReadPromise = waitForApi(adminPage, '/isRead', 'POST');
          await unreadCard.click();
          await expectApiSuccess(await markReadPromise);
          const markedCard = adminPage.locator('.notification-card', { hasText: markedTitle }).first();
          await expect(markedCard).not.toHaveClass(/unread/);
        }
      });
      await test.step('ADMIN-05～07 活動 A 建立、要求補件、重新送審', async () => {
        progress('ADMIN-05 建立並送審活動 A');
        const organizerConfig = authRoleCases.find((item) => item.role === 'organizer')!;
        const organizerLoginResponse = await loginWithUi(
          organizerPage,
          organizerConfig,
          credentials!.organizer.email,
          credentials!.organizer.password,
        );
        const organizerLoginBody = await expectApiSuccess<{ user?: { role?: string } }>(
          organizerLoginResponse,
        );
        expect(organizerLoginBody.data?.user?.role).toBe('ORGANIZER');
        await expect(organizerPage).toHaveURL(organizerConfig.dashboardPath);

        await adminPage.goto('/admin/dash-board/home');
        const beforeReviewCount = await readTodoCount(adminPage, '活動審核');

        const now = Date.now();
        state.eventAId = await createAndSubmitMinimalEvent(organizerPage, eventAName, {
          registrationStartsAt: new Date(now + 5 * 60 * 1000),
          registrationEndsAt: new Date(now + 10 * 60 * 1000),
          eventStartsAt: new Date(now + 48 * 60 * 60 * 1000),
          eventEndsAt: new Date(now + 48 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
        });

        progress('ADMIN-06 管理員要求補件');
        await adminPage.goto('/admin/dash-board/notification');
        await adminPage.reload();
        await expectNotificationVisible(adminPage, eventAName);

        await adminPage.goto('/admin/dash-board/home');
        const afterReviewCount = await readTodoCount(adminPage, '活動審核');
        expect(afterReviewCount).toBeGreaterThan(beforeReviewCount);

        await adminPage.goto(`/admin/dash-board/activity/detail/${state.eventAId}`);
        await expect(adminPage.getByRole('heading', { name: eventAName })).toBeVisible();
        await adminPage.locator('.header-actions button', { hasText: '要求補件' }).click();
        await adminPage.locator('#supplementReason').fill('E2E 測試：請補充活動介紹細節。');
        await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();

        const revisionPromise = waitForApi(
          adminPage,
          `/api/admin/events/${state.eventAId}/request-revision`,
          'POST',
        );
        await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();
        await expectApiSuccess(await revisionPromise);
        await closeAlert(adminPage, '補件要求已送出', '確定');
        await expect(adminPage.getByText('補件中', { exact: true }).first()).toBeVisible();

        progress('ADMIN-07 主辦方重新送審活動 A');
        await organizerPage.goto('/organizer/dash-board/notification');
        await organizerPage.reload();
        await expectNotificationVisible(organizerPage, eventAName);

        await organizerPage.goto(`/organizer/dash-board/activity/detail/${state.eventAId}`);
        await expect(organizerPage.getByText('補件中', { exact: true }).first()).toBeVisible();
        await organizerPage.getByRole('button', { name: '重新送審', exact: true }).click();
        const resubmitPromise = waitForApi(
          organizerPage,
          `/api/organizer/events/${state.eventAId}/submit-review`,
          'POST',
        );
        await organizerPage.getByRole('button', { name: '確定重新送審', exact: true }).click();
        await expectApiSuccess(await resubmitPromise);
        await closeAlert(organizerPage, '重新送審成功', '知道了');
        await expect(organizerPage.getByText('待審核', { exact: true }).first()).toBeVisible();
      });
      await test.step('ADMIN-08～10 活動 A 審核通過、地圖建置、發布', async () => {
        progress('ADMIN-08 管理員審核通過活動 A');
        await adminPage.goto('/admin/dash-board/home');
        const beforeMapBuildingCount = await readTodoCount(adminPage, '活動地圖建置');

        await adminPage.goto(`/admin/dash-board/activity/detail/${state.eventAId}`);
        await adminPage.locator('.header-actions button', { hasText: '審核通過' }).click();
        const approvePromise = waitForApi(adminPage, `/api/admin/events/${state.eventAId}/approve`, 'POST');
        await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();
        await expectApiSuccess(await approvePromise);
        await closeAlert(adminPage, '審核通過', '確定');
        await expect(adminPage.getByText('地圖建置中', { exact: true }).first()).toBeVisible();

        await adminPage.goto('/admin/dash-board/home');
        const afterMapBuildingCount = await readTodoCount(adminPage, '活動地圖建置');
        expect(afterMapBuildingCount).toBeGreaterThan(beforeMapBuildingCount);

        progress('ADMIN-09 管理員完成活動 A 地圖建置');
        await adminPage.goto(`/admin/dash-board/activity/detail/${state.eventAId}`);
        const mapCompleteButton = adminPage.locator('.header-actions button', { hasText: '地圖建置完成' });
        await expect(mapCompleteButton).toBeVisible();
        await mapCompleteButton.click();
        const mapPromise = waitForApi(adminPage, `/api/admin/events/${state.eventAId}/map-complete`, 'POST');
        await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();
        await expectApiSuccess(await mapPromise);
        await closeAlert(adminPage, '地圖建置已送出', '確定');
        await expect(adminPage.getByText('待發布', { exact: true }).first()).toBeVisible();

        progress('ADMIN-10 主辦方發布活動 A');
        await organizerPage.goto('/organizer/dash-board/notification');
        await organizerPage.reload();
        await expectNotificationVisible(organizerPage, eventAName);

        await organizerPage.goto(`/organizer/dash-board/activity/detail/${state.eventAId}`);
        await expect(organizerPage.getByRole('button', { name: '發布活動', exact: true })).toBeVisible();
        await organizerPage.getByRole('button', { name: '發布活動', exact: true }).click();
        const publishPromise = waitForApi(
          organizerPage,
          `/api/organizer/events/${state.eventAId}/publish`,
          'POST',
        );
        await organizerPage.getByRole('button', { name: '確定發布', exact: true }).click();
        await expectApiSuccess(await publishPromise);
        await closeAlert(organizerPage, '發布活動成功', '知道了');
        await organizerPage.reload();
        await expect(organizerPage.getByText(/已發布|報名中/).first()).toBeVisible();
      });
      await test.step('ADMIN-11～14 活動 A 下架審核（駁回後核准）', async () => {
        progress('ADMIN-11 主辦方第一次申請下架');
        await adminPage.goto('/admin/dash-board/home');
        const beforeUnpublishCount = await readTodoCount(adminPage, '活動下架申請');

        await organizerPage.goto(`/organizer/dash-board/activity/detail/${state.eventAId}`);
        await organizerPage.getByRole('button', { name: '下架活動', exact: true }).click();
        await organizerPage.locator('#requiredReason').fill('E2E 測試：第一次下架申請（預期被駁回）。');
        await organizerPage.getByRole('button', { name: '下一步', exact: true }).click();
        const unpublishRequestPromise1 = waitForApi(
          organizerPage,
          `/api/organizer/events/${state.eventAId}/unpublish-request`,
          'POST',
        );
        await organizerPage.getByRole('button', { name: '確認送出', exact: true }).click();
        await expectApiSuccess(await unpublishRequestPromise1);
        await closeAlert(organizerPage, '下架申請已送出', '知道了');
        await expect(organizerPage.getByText('下架申請中', { exact: true }).first()).toBeVisible();

        progress('ADMIN-12 管理員不同意下架（第一次）');
        await adminPage.goto('/admin/dash-board/notification');
        await adminPage.reload();
        await expectNotificationVisible(adminPage, eventAName);

        await adminPage.goto('/admin/dash-board/home');
        const afterUnpublishCount = await readTodoCount(adminPage, '活動下架申請');
        expect(afterUnpublishCount).toBeGreaterThan(beforeUnpublishCount);

        await adminPage.goto(`/admin/dash-board/activity/detail/${state.eventAId}`);
        await adminPage.locator('.header-actions button', { hasText: '下架審核' }).click();
        await adminPage.getByLabel('不同意下架', { exact: true }).check();
        await adminPage.locator('#supplementReason').fill('E2E 測試：資料尚不完整，請補充後再申請。');
        const rejectPromise = waitForApi(adminPage, '/request-revision', 'POST');
        await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();
        await expectApiSuccess(await rejectPromise);
        await closeAlert(adminPage, '已駁回下架申請', '確定');
        await expect(adminPage.getByText('已發布', { exact: true }).first()).toBeVisible();

        progress('ADMIN-13 主辦方第二次申請下架');
        await organizerPage.goto('/organizer/dash-board/notification');
        await organizerPage.reload();
        await expectNotificationVisible(organizerPage, eventAName);

        await organizerPage.goto(`/organizer/dash-board/activity/detail/${state.eventAId}`);
        await expect(organizerPage.getByText('已發布', { exact: true }).first()).toBeVisible();
        await organizerPage.getByRole('button', { name: '下架活動', exact: true }).click();
        await organizerPage.locator('#requiredReason').fill('E2E 測試：第二次下架申請（預期被核准）。');
        await organizerPage.getByRole('button', { name: '下一步', exact: true }).click();
        const unpublishRequestPromise2 = waitForApi(
          organizerPage,
          `/api/organizer/events/${state.eventAId}/unpublish-request`,
          'POST',
        );
        await organizerPage.getByRole('button', { name: '確認送出', exact: true }).click();
        await expectApiSuccess(await unpublishRequestPromise2);
        await closeAlert(organizerPage, '下架申請已送出', '知道了');
        await expect(organizerPage.getByText('下架申請中', { exact: true }).first()).toBeVisible();

        progress('ADMIN-14 管理員同意下架（第二次）');
        await adminPage.goto(`/admin/dash-board/activity/detail/${state.eventAId}`);
        await adminPage.locator('.header-actions button', { hasText: '下架審核' }).click();
        await adminPage.getByLabel('同意下架', { exact: true }).check();
        const confirmUnpublishPromise = waitForApi(
          adminPage,
          `/api/admin/events/${state.eventAId}/unpublish-confirm`,
          'POST',
        );
        await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();
        await expectApiSuccess(await confirmUnpublishPromise);
        await closeAlert(adminPage, '審核通過', '確定');
        await expect(adminPage.getByText('已下架', { exact: true }).first()).toBeVisible();

        await organizerPage.goto('/organizer/dash-board/notification');
        await organizerPage.reload();
        await expectNotificationVisible(organizerPage, eventAName);
      });
      await test.step('ADMIN-18～23 目標主辦方帳號管理', async () => {
        progress('ADMIN-18 搜尋使用者列表');
        await adminPage.goto('/admin/dash-board/users');
        await adminPage.getByPlaceholder('搜尋姓名/Email').fill(credentials!.targetOrganizer.email);
        // 進頁面時 AdminDashboardUserManagement 會自動打一次無關鍵字的預設查詢
        // （跟 ADMIN-29 操作紀錄頁同樣的模式），若只比對 URL/method 可能搶接到那次
        // 回應而不是點擊搜尋後的結果，因此同時比對 request body 的 keyWord。
        const searchUsersPromise = adminPage.waitForResponse((response) =>
          response.url().includes('/api/admin/users/search') &&
          response.request().method() === 'POST' &&
          response.request().postDataJSON()?.keyWord === credentials!.targetOrganizer.email,
        );
        await adminPage.locator('.app-btn.search').click();
        const usersBody = await expectApiSuccess<{
          items?: Array<{ id?: number; email?: string; role?: string }>;
        }>(await searchUsersPromise);
        const targetOrganizerRow = usersBody.data?.items?.find(
          (item) => item.email === credentials!.targetOrganizer.email,
        );
        expect(targetOrganizerRow?.id).toBeTruthy();
        state.targetOrganizerUserId = Number(targetOrganizerRow!.id);

        progress('ADMIN-19 開啟目標主辦方詳細頁');
        const organizerDetailPromise = waitForApi(adminPage, `/api/admin/users/${state.targetOrganizerUserId}`, 'GET');
        await adminPage.goto(`/admin/dash-board/user/detail/organizer/${state.targetOrganizerUserId}`);
        await expectApiSuccess(await organizerDetailPromise);
        await expect(adminPage.getByText(credentials!.targetOrganizer.email, { exact: true })).toBeVisible();

        progress('ADMIN-20 停用目標主辦方帳號');
        await adminPage.getByRole('button', { name: '停用帳號', exact: true }).click();
        const disableOrganizerPromise = waitForApi(
          adminPage,
          `/api/admin/users/${state.targetOrganizerUserId}/disable`,
          'POST',
        );
        await adminPage.getByRole('button', { name: '確認停用', exact: true }).click();
        await expectApiSuccess(await disableOrganizerPromise);
        await closeAlert(adminPage, '帳號已停用', '確定');
        await expect(adminPage.getByText('已停用', { exact: true }).first()).toBeVisible();

        progress('ADMIN-21 目標主辦方停用期間無法登入');
        const organizerConfig = authRoleCases.find((item) => item.role === 'organizer')!;
        const rejectedLoginResponse = await loginWithUi(
          targetOrganizerPage,
          organizerConfig,
          credentials!.targetOrganizer.email,
          credentials!.targetOrganizer.password,
        );
        const rejectedLoginBody = await rejectedLoginResponse.json();
        expect(rejectedLoginBody.statusCode).toBe(400);
        await expect(targetOrganizerPage.getByRole('dialog')).toContainText(/停用/);
        await expect(targetOrganizerPage).toHaveURL(organizerConfig.loginPath);

        progress('ADMIN-22 恢復目標主辦方帳號');
        await adminPage.goto(`/admin/dash-board/user/detail/organizer/${state.targetOrganizerUserId}`);
        await adminPage.getByRole('button', { name: '恢復帳號', exact: true }).click();
        const restoreOrganizerPromise = waitForApi(
          adminPage,
          `/api/admin/users/${state.targetOrganizerUserId}/restore`,
          'POST',
        );
        await adminPage.getByRole('button', { name: '確認恢復', exact: true }).click();
        await expectApiSuccess(await restoreOrganizerPromise);
        await closeAlert(adminPage, '帳號已恢復', '確定');
        await expect(adminPage.getByText('正常', { exact: true }).first()).toBeVisible();

        progress('ADMIN-23 目標主辦方恢復後能重新登入');
        const restoredLoginResponse = await loginWithUi(
          targetOrganizerPage,
          organizerConfig,
          credentials!.targetOrganizer.email,
          credentials!.targetOrganizer.password,
        );
        const restoredLoginBody = await expectApiSuccess<{ user?: { role?: string } }>(restoredLoginResponse);
        expect(restoredLoginBody.data?.user?.role).toBe('ORGANIZER');
        await expect(targetOrganizerPage).toHaveURL(organizerConfig.dashboardPath);
      });
      await test.step('ADMIN-24～28 目標攤主帳號管理', async () => {
        progress('ADMIN-24 搜尋並開啟目標攤主詳細頁');
        await adminPage.goto('/admin/dash-board/users');
        await adminPage.getByPlaceholder('搜尋姓名/Email').fill(credentials!.targetVendor.email);
        // 同 ADMIN-18 的說明：避免搶接到進頁面時自動觸發的無關鍵字預設查詢。
        const searchVendorPromise = adminPage.waitForResponse((response) =>
          response.url().includes('/api/admin/users/search') &&
          response.request().method() === 'POST' &&
          response.request().postDataJSON()?.keyWord === credentials!.targetVendor.email,
        );
        await adminPage.locator('.app-btn.search').click();
        const vendorUsersBody = await expectApiSuccess<{
          items?: Array<{ id?: number; email?: string }>;
        }>(await searchVendorPromise);
        const targetVendorRow = vendorUsersBody.data?.items?.find(
          (item) => item.email === credentials!.targetVendor.email,
        );
        expect(targetVendorRow?.id).toBeTruthy();
        state.targetVendorUserId = Number(targetVendorRow!.id);

        const vendorDetailPromise = waitForApi(adminPage, `/api/admin/users/${state.targetVendorUserId}`, 'GET');
        await adminPage.goto(`/admin/dash-board/user/detail/vender/${state.targetVendorUserId}`);
        await expectApiSuccess(await vendorDetailPromise);
        await expect(adminPage.getByText(credentials!.targetVendor.email, { exact: true })).toBeVisible();

        progress('ADMIN-25 停用目標攤主帳號');
        await adminPage.getByRole('button', { name: '停用帳號', exact: true }).click();
        const disableVendorPromise = waitForApi(
          adminPage,
          `/api/admin/users/${state.targetVendorUserId}/disable`,
          'POST',
        );
        await adminPage.getByRole('button', { name: '確認停用', exact: true }).click();
        await expectApiSuccess(await disableVendorPromise);
        await closeAlert(adminPage, '帳號已停用', '確定');
        await expect(adminPage.getByText('已停用', { exact: true }).first()).toBeVisible();

        progress('ADMIN-26 目標攤主停用期間無法登入');
        const vendorConfig = authRoleCases.find((item) => item.role === 'vendor')!;
        const rejectedVendorLogin = await loginWithUi(
          targetVendorPage,
          vendorConfig,
          credentials!.targetVendor.email,
          credentials!.targetVendor.password,
        );
        const rejectedVendorBody = await rejectedVendorLogin.json();
        expect(rejectedVendorBody.statusCode).toBe(400);
        await expect(targetVendorPage.getByRole('dialog')).toContainText(/停用/);
        await expect(targetVendorPage).toHaveURL(vendorConfig.loginPath);

        progress('ADMIN-27 恢復目標攤主帳號');
        await adminPage.goto(`/admin/dash-board/user/detail/vender/${state.targetVendorUserId}`);
        await adminPage.getByRole('button', { name: '恢復帳號', exact: true }).click();
        const restoreVendorPromise = waitForApi(
          adminPage,
          `/api/admin/users/${state.targetVendorUserId}/restore`,
          'POST',
        );
        await adminPage.getByRole('button', { name: '確認恢復', exact: true }).click();
        await expectApiSuccess(await restoreVendorPromise);
        await closeAlert(adminPage, '帳號已恢復', '確定');
        await expect(adminPage.getByText('正常', { exact: true }).first()).toBeVisible();

        progress('ADMIN-28 目標攤主恢復後能重新登入');
        const restoredVendorLogin = await loginWithUi(
          targetVendorPage,
          vendorConfig,
          credentials!.targetVendor.email,
          credentials!.targetVendor.password,
        );
        const restoredVendorBody = await expectApiSuccess<{ user?: { role?: string } }>(restoredVendorLogin);
        expect(restoredVendorBody.data?.user?.role).toBe('VENDOR');
        await expect(targetVendorPage).toHaveURL(vendorConfig.dashboardPath);
      });
      await test.step('ADMIN-29 操作紀錄查詢', async () => {
        progress('ADMIN-29 操作紀錄查詢');

        async function searchLogOperationTypes(keyword: string): Promise<Set<string>> {
          await adminPage.goto('/admin/dash-board/logs');
          await adminPage.getByPlaceholder('請輸入搜尋內容').fill(keyword);
          // 進頁面時 AdminDashboardLogs 會自動打一次無關鍵字的預設查詢（ngAfterViewInit），
          // 若只比對 URL/method，可能會搶先接到那次還沒有 keyWord 的回應而不是點擊搜尋後的結果，
          // 因此改成同時比對 request body 的 keyWord 是否等於這次輸入的關鍵字。
          const logsPromise = adminPage.waitForResponse((response) =>
            response.url().includes('/api/admin/logs/search') &&
            response.request().method() === 'POST' &&
            response.request().postDataJSON()?.keyWord === keyword,
          );
          await adminPage.locator('.app-btn.search').click();
          const body = await expectApiSuccess<{
            items?: Array<{ operationType?: string }>;
          }>(await logsPromise);
          return new Set((body.data?.items ?? []).map((item) => item.operationType));
        }

        const eventALogTypes = await searchLogOperationTypes(eventAName);
        expect(eventALogTypes.has('requestRevision')).toBe(true);
        expect(eventALogTypes.has('eventUnpublishReview')).toBe(true);

        const targetOrganizerLogTypes = await searchLogOperationTypes(credentials!.targetOrganizer.email);
        expect(targetOrganizerLogTypes.has('accountDisabled')).toBe(true);
        expect(targetOrganizerLogTypes.has('accountRestored')).toBe(true);
      });
    } finally {
      await Promise.all([
        adminContext.close(),
        organizerContext.close(),
        targetOrganizerContext.close(),
        targetVendorContext.close(),
      ]);
    }
  });
});

function requiredCredentials(): AdminFlowCredentials | null {
  const admin = getCredentials(authRoleCases.find((item) => item.role === 'admin')!);
  const organizer = getCredentials(authRoleCases.find((item) => item.role === 'organizer')!);
  const targetOrganizerEmail = process.env['E2E_TARGET_ORGANIZER_EMAIL'];
  const targetOrganizerPassword = process.env['E2E_TARGET_ORGANIZER_PASSWORD'];
  const targetVendorEmail = process.env['E2E_TARGET_VENDOR_EMAIL'];
  const targetVendorPassword = process.env['E2E_TARGET_VENDOR_PASSWORD'];

  if (
    !admin.email || !admin.password ||
    !organizer.email || !organizer.password ||
    !targetOrganizerEmail || !targetOrganizerPassword ||
    !targetVendorEmail || !targetVendorPassword
  ) {
    return null;
  }

  return {
    admin: { email: admin.email, password: admin.password },
    organizer: { email: organizer.email, password: organizer.password },
    targetOrganizer: { email: targetOrganizerEmail, password: targetOrganizerPassword },
    targetVendor: { email: targetVendorEmail, password: targetVendorPassword },
  };
}

function waitForApi(page: Page, path: string, method: string): Promise<Response> {
  return page.waitForResponse((response) =>
    response.url().includes(path) && response.request().method() === method,
  );
}

async function expectApiSuccess<T = Record<string, unknown>>(
  response: Response,
): Promise<ApiEnvelope<T>> {
  const body = (await response.json()) as ApiEnvelope<T>;
  expect(response.ok(), `${response.request().method()} ${response.url()}`).toBe(true);
  expect(body.statusCode).toBeGreaterThanOrEqual(200);
  expect(body.statusCode).toBeLessThan(300);
  return body;
}

async function closeAlert(page: Page, title: string, buttonName: string): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(title);
  await dialog.getByRole('button', { name: buttonName, exact: true }).click();
}

async function chooseDropdown(dropdown: Locator, option: string): Promise<void> {
  await dropdown.locator('.select-btn').click();
  await dropdown.getByRole('option', { name: option, exact: true }).click();
}

async function clickNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: '下一步', exact: true }).click();
}

async function fillDateTime(page: Page, prefix: string, date: Date): Promise<void> {
  await page.locator(`input[name="${prefix}Date"]`).fill(formatDate(date));
  await page.locator(`input[name="${prefix}Time"]`).fill(formatTime(date));
}

function formatDate(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatTime(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

async function readTodoCount(page: Page, label: string): Promise<number> {
  const card = page.locator('.todo-card', { hasText: label });
  await expect(card).toBeVisible();
  const text = await card.locator('.count-num').textContent();
  return Number((text ?? '0').trim());
}

async function expectNotificationVisible(page: Page, keyword: string): Promise<void> {
  await expect(page.locator('.notification-card', { hasText: keyword }).first())
    .toBeVisible({ timeout: 15_000 });
}

async function createAndSubmitMinimalEvent(
  page: Page,
  eventName: string,
  times: EventTimes,
): Promise<number> {
  await page.goto('/organizer/dash-board/activity/detail');
  await expect(page.locator('h2.form-section-title')).toContainText('活動基本資料');

  await page.locator('input[name="eventName"]').fill(eventName);
  await page.locator('label.category-option', { hasText: '文創手作' }).locator('input').check();
  await page.locator('.cover-field input[type="file"]').setInputFiles(eventCoverPath);
  await page.locator('textarea[name="description"]').fill('E2E 管理員後台測試活動簡介');
  await page.locator('textarea[name="introduction"]').fill(
    '此活動由 Playwright 自動建立，用來驗證管理員後台的審核與下架流程。',
  );
  await clickNext(page);

  await fillDateTime(page, 'eventStart', times.eventStartsAt);
  await fillDateTime(page, 'eventEnd', times.eventEndsAt);
  await fillDateTime(page, 'registrationStart', times.registrationStartsAt);
  await fillDateTime(page, 'registrationEnd', times.registrationEndsAt);
  await page.locator('input[name="metro"]').fill('無');
  await page.locator('input[name="bus"]').fill('E2E 測試公車站');
  await page.locator('input[name="driving"]').fill('場地附設停車區');
  await clickNext(page);

  const venuePanel = page.locator('.venue-location-grid');
  await chooseDropdown(venuePanel.locator('app-dropdown').nth(0), '台北市');
  await chooseDropdown(venuePanel.locator('app-dropdown').nth(1), '中正區');
  await page.locator('input[name="address"]').fill('八德路一段 1 號');
  await page.locator('input[name="venueName"]').fill('E2E 管理員測試場地');
  await page.locator('input[name="boothLength"]').fill('3');
  await page.locator('input[name="boothWidth"]').fill('3');
  await page.locator('input[name="totalBooths"]').fill('2');
  await page.locator('input[name="boothPrice"]').fill('1200');
  await page.locator('input[name="depositAmount"]').fill('1000');

  await page.getByRole('button', { name: '新增分區' }).click();
  const zoneDialog = page.getByRole('dialog', { name: '新增攤位分區' });
  await zoneDialog.getByRole('button', { name: /選擇顏色/ }).first().click();
  await chooseDropdown(zoneDialog.locator('app-dropdown'), 'A 區');
  await zoneDialog.locator('input[name="zoneDialogCount"]').fill('2');
  await zoneDialog.getByRole('button', { name: '新增分區' }).click();
  await expect(zoneDialog).toBeHidden();
  await page.locator('.layout-upload-panel input[type="file"]').setInputFiles(eventMapPath);
  await clickNext(page);

  await page.getByLabel('不提供設備租借', { exact: true }).check();
  await page.getByLabel('不提供基本用電', { exact: true }).check();
  await page.getByLabel('不開放額外申請', { exact: true }).check();

  await page.getByRole('button', { name: '送出審核', exact: true }).click();
  const saveEventPromise = waitForApi(page, '/api/organizer/events', 'POST');
  await page.getByRole('button', { name: '確定送出', exact: true }).click();
  const saveEventBody = await expectApiSuccess<{ eventId?: number }>(await saveEventPromise);
  const eventId = Number(saveEventBody.data?.eventId);
  expect(eventId).toBeGreaterThan(0);

  const reviewResponse = await page.waitForResponse((response) =>
    response.url().endsWith(`/api/organizer/events/${eventId}/submit-review`) &&
    response.request().method() === 'POST',
  );
  await expectApiSuccess(reviewResponse);
  await closeAlert(page, '送出審核成功', '知道了');
  await expect(page).toHaveURL(new RegExp(`/organizer/dash-board/activity/detail/${eventId}`));
  await expect(page.getByText('待審核', { exact: true }).first()).toBeVisible();

  return eventId;
}

function progress(step: string): void {
  console.log(`[admin-management] ${step}`);
}
