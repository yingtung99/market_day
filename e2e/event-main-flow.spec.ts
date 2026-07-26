import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { Locator, Page, Response } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  authRoleCases,
  getCredentials,
  loginWithUi,
  type AuthRole,
} from './auth-test-helpers';

interface ApiEnvelope<T = Record<string, unknown>> {
  statusCode?: number;
  message?: string;
  data?: T;
}

interface MainFlowState {
  eventId: number;
  applicationId: number;
  applicationNo: string;
  expectedTotal: number;
  selectedStallNo: string;
}

const eventCoverPath = resolve('src/assets/images/market/cards/market-card-01.png');
const eventMapPath = resolve('src/assets/images/market/cards/market-card-02.png');
const brandImagePath = resolve('src/assets/images/market/cards/market-card-03.png');
const productImagePath = resolve('src/assets/images/market/cards/market-card-04.png');

const isDemo = process.env['E2E_DEMO'] === '1';
const apiBaseUrl = (process.env['E2E_API_BASE_URL'] ?? 'http://localhost:8081').replace(/\/$/, '');
const newebPaySandboxCardNumber = '4000221111111111';
const newebPaySandboxSecurityCode = '123';

test.describe('Market Day 活動主流程', () => {
  test('@main-flow 活動從建立、付款、選位到公開結果的完整主流程', async ({ browser }) => {
    test.setTimeout(15 * 60 * 1000);

    const credentials = requiredCredentials();
    test.skip(!credentials, '主流程需要主辦方、管理員與攤主三種 E2E 測試帳號。');

    // 唯一性由自然的市集主題組合提供，畫面不顯示 timestamp 或 UUID。
    const eventName = createNaturalEventName('日光慢旅生活市集');
    const organizerName = '沐日市集企劃工作室';
    const brandName = '山眠植作';
    const productName = '苔球與原木植栽組';
    const vehicleNo = createUniqueVehicleNo();
    // 建立活動與上傳圖片需要一些時間，開始時間至少預留 5 分鐘，避免
    // 測試執行較慢時送審被「報名開始時間已過」的前端驗證擋下。
    const registrationOpensAt = roundUpToMinute(new Date(Date.now() + 5 * 60 * 1000));
    // 留出足夠操作時間，同時讓本次 E2E 能等待每分鐘執行的自動選位排程。
    const registrationWindowMs = isDemo ? 8 * 60 * 1000 : 2 * 60 * 1000;
    const registrationEndsAt = new Date(registrationOpensAt.getTime() + registrationWindowMs);
    const eventStartsAt = new Date(registrationOpensAt.getTime() + 48 * 60 * 60 * 1000);
    const eventEndsAt = new Date(eventStartsAt.getTime() + 8 * 60 * 60 * 1000);

    // Headless Chromium does not apply --start-maximized and otherwise falls back
    // to 800x600, which switches the dashboards to their mobile navigation.
    const desktopViewport = { width: 1440, height: 900 };
    const organizerContext = await browser.newContext({ viewport: desktopViewport });
    const adminContext = await browser.newContext({ viewport: desktopViewport });
    const vendorContext = await browser.newContext({ viewport: desktopViewport });
    const publicContext = await browser.newContext({ viewport: desktopViewport });

    const organizerPage = await organizerContext.newPage();
    const adminPage = await adminContext.newPage();
    const vendorPage = await vendorContext.newPage();
    const publicPage = await publicContext.newPage();

    for (const page of [organizerPage, adminPage, vendorPage, publicPage]) {
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(30_000);
    }

    const state: MainFlowState = {
      eventId: 0,
      applicationId: 0,
      applicationNo: '',
      expectedTotal: 0,
      selectedStallNo: '',
    };

    try {
      await test.step('FLOW-01～03 主辦方登入、儲存並重新載入資料', async () => {
        progress('FLOW-01～03 主辦方資料');
        await loginAndVerify(organizerPage, 'organizer', credentials!.organizer);
        await openOrganizerProfile(organizerPage);
        await fillOrganizerProfile(
          organizerPage,
          organizerName,
          credentials!.organizer.email,
        );

        const saveResponsePromise = waitForApi(
          organizerPage,
          '/api/organizer/profile/save',
          'POST',
        );
        await organizerPage.getByRole('dialog').getByRole('button', { name: '儲存', exact: true }).click();
        await expectApiSuccess(await saveResponsePromise);
        await closeAlert(organizerPage, '主辦方資料已儲存', '確定');

        await openOrganizerProfile(organizerPage);
        const profileDialog = organizerPage.getByRole('dialog');
        await expect(profileDialog.locator('input[name="organizerName"]')).toHaveValue(organizerName);
        await expect(profileDialog.locator('input[name="contactEmail"]')).toHaveValue(
          credentials!.organizer.email,
        );
        await profileDialog.getByRole('button', { name: '關閉主辦方資料' }).click();
        await demoPause(organizerPage);
      });

      await test.step('FLOW-04～05 主辦方建立並送審活動', async () => {
        progress('FLOW-04～05 建立並送審活動');
        await organizerPage.goto('/organizer/dash-board/activity/detail');
        await expect(organizerPage.locator('h2.form-section-title')).toContainText('活動基本資料');

        await organizerPage.locator('input[name="eventName"]').fill(eventName);
        await organizerPage.locator('label.category-option', { hasText: '文創手作' }).locator('input').check();
        await organizerPage.locator('.cover-field input[type="file"]').setInputFiles(eventCoverPath);
        await organizerPage.locator('textarea[name="description"]').fill('以植物、手作與風格選物為主題的夏日午後生活市集。');
        await organizerPage.locator('textarea[name="introduction"]').fill(
          '集結台灣獨立品牌、植栽創作者與甜點職人，規劃品牌展售、手作體驗及親子休息空間，歡迎民眾在城市中享受悠閒的週末午後。',
        );
        await clickNext(organizerPage);

        await fillDateTime(organizerPage, 'eventStart', eventStartsAt);
        await fillDateTime(organizerPage, 'eventEnd', eventEndsAt);
        await fillDateTime(organizerPage, 'registrationStart', registrationOpensAt);
        await fillDateTime(organizerPage, 'registrationEnd', registrationEndsAt);
        await organizerPage.locator('input[name="metro"]').fill('無');
        await organizerPage.locator('input[name="bus"]').fill('搭乘 202、205 或 257 路公車至臺北科技大學站，步行約 3 分鐘');
        await organizerPage.locator('input[name="driving"]').fill('場地附設停車區');
        await clickNext(organizerPage);

        const venuePanel = organizerPage.locator('.venue-location-grid');
        await chooseDropdown(venuePanel.locator('app-dropdown').nth(0), '台北市');
        await chooseDropdown(venuePanel.locator('app-dropdown').nth(1), '中正區');
        await organizerPage.locator('input[name="address"]').fill('八德路一段 1 號');
        await organizerPage.locator('input[name="venueName"]').fill('華山文創園區・東二館');
        await organizerPage.locator('input[name="boothLength"]').fill('3');
        await organizerPage.locator('input[name="boothWidth"]').fill('3');
        await organizerPage.locator('input[name="totalBooths"]').fill('2');
        await organizerPage.locator('input[name="boothPrice"]').fill('1200');
        await organizerPage.locator('input[name="depositAmount"]').fill('1000');

        await organizerPage.getByRole('button', { name: '新增分區' }).click();
        const zoneDialog = organizerPage.getByRole('dialog', { name: '新增攤位分區' });
        await zoneDialog.getByRole('button', { name: /選擇顏色/ }).first().click();
        await chooseDropdown(zoneDialog.locator('app-dropdown'), 'A 區');
        await zoneDialog.locator('input[name="zoneDialogCount"]').fill('2');
        await zoneDialog.getByRole('button', { name: '新增分區' }).click();
        await expect(zoneDialog).toBeHidden();
        await organizerPage.locator('.layout-upload-panel input[type="file"]').setInputFiles(eventMapPath);
        await clickNext(organizerPage);

        await organizerPage.getByLabel('提供設備租借', { exact: true }).check();
        await organizerPage.getByRole('button', { name: '新增設備' }).click();
        const equipmentDialog = organizerPage.getByRole('dialog', { name: '新增設備' });
        await equipmentDialog.locator('input[name="equipmentName"]').fill('六尺木紋展示桌');
        await equipmentDialog.locator('input[name="equipmentUnit"]').fill('張');
        await equipmentDialog.locator('textarea[name="equipmentSpecification"]').fill('180 x 60 cm');
        await equipmentDialog.locator('input[name="equipmentFreeQuantity"]').fill('0');
        await equipmentDialog.getByLabel('開放租借', { exact: true }).check();
        await equipmentDialog.locator('input[name="equipmentRentalPrice"]').fill('100');
        await equipmentDialog.locator('input[name="equipmentRentalLimit"]').fill('2');
        await equipmentDialog.locator('input[name="equipmentDailyRentalQuantity"]').fill('10');
        await equipmentDialog.getByRole('button', { name: '確認新增' }).click();

        await organizerPage.getByLabel('提供基本用電', { exact: true }).check();
        await organizerPage.getByRole('button', { name: '新增基本用電' }).click();
        const basicPowerDialog = organizerPage.getByRole('dialog', { name: '新增基本用電' });
        await basicPowerDialog.locator('input[name="basicPowerVoltage"]').fill('110V');
        await basicPowerDialog.locator('input[name="basicPowerWattage"]').fill('500');
        await basicPowerDialog.locator('textarea[name="basicPowerDescription"]').fill('一般設備使用');
        await basicPowerDialog.getByRole('button', { name: '儲存', exact: true }).click();

        await organizerPage.getByLabel('開放額外申請', { exact: true }).check();
        await organizerPage.getByRole('button', { name: '新增用電方案' }).click();
        const extraPowerDialog = organizerPage.getByRole('dialog', { name: '新增用電方案' });
        await extraPowerDialog.locator('input[name="extraPowerVoltage"]').fill('110V');
        await extraPowerDialog.locator('input[name="extraPowerWattage"]').fill('1000');
        await extraPowerDialog.locator('input[name="extraPowerFee"]').fill('200');
        await extraPowerDialog.locator('textarea[name="extraPowerDescription"]').fill('高功率餐飲設備用電');
        await extraPowerDialog.getByRole('button', { name: '儲存', exact: true }).click();

        await organizerPage.getByRole('button', { name: '送出審核', exact: true }).click();
        const saveEventPromise = waitForApi(organizerPage, '/api/organizer/events', 'POST');
        const reviewEventPromise = organizerPage.waitForResponse((response) =>
          /\/api\/organizer\/events\/\d+\/submit-review$/.test(new URL(response.url()).pathname) &&
          response.request().method() === 'POST',
        );
        await organizerPage.getByRole('button', { name: '確定送出', exact: true }).click();
        const saveEventBody = await expectApiSuccess<{ eventId?: number }>(await saveEventPromise);
        state.eventId = Number(saveEventBody.data?.eventId);
        expect(state.eventId).toBeGreaterThan(0);

        const reviewResponse = await reviewEventPromise;
        expect(new URL(reviewResponse.url()).pathname).toBe(
          `/api/organizer/events/${state.eventId}/submit-review`,
        );
        await expectApiSuccess(reviewResponse);
        await closeAlert(organizerPage, '送出審核成功', '知道了');
        await expect(organizerPage).toHaveURL(new RegExp(`/organizer/dash-board/activity/detail/${state.eventId}`));
        await expect(organizerPage.getByText('待審核', { exact: true }).first()).toBeVisible();
        await demoPause(organizerPage);
      });

      await test.step('FLOW-06～08 管理員審核並完成地圖', async () => {
        progress('FLOW-06～08 管理員審核與地圖');
        await loginAndVerify(adminPage, 'admin', credentials!.admin);
        await adminPage.goto(`/admin/dash-board/activity/detail/${state.eventId}`);
        await expect(adminPage).toHaveURL(new RegExp(`/admin/dash-board/activity/detail/${state.eventId}`));
        await expect(adminPage.getByRole('heading', { name: eventName })).toBeVisible();

        await adminPage.locator('.header-actions button', { hasText: '審核通過' }).click();
        const approvePromise = waitForApi(adminPage, `/api/admin/events/${state.eventId}/approve`, 'POST');
        await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();
        await expectApiSuccess(await approvePromise);
        await closeAlert(adminPage, '審核通過', '確定');

        const mapCompleteButton = adminPage.locator('.header-actions button', { hasText: '地圖建置完成' });
        await expect(mapCompleteButton).toBeVisible();
        await mapCompleteButton.click();
        const mapPromise = waitForApi(adminPage, `/api/admin/events/${state.eventId}/map-complete`, 'POST');
        await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();
        await expectApiSuccess(await mapPromise);
        await closeAlert(adminPage, '地圖建置已送出', '確定');
        await expect(adminPage.getByText('待發布', { exact: true }).first()).toBeVisible();
        await demoPause(adminPage);
      });

      await test.step('FLOW-09 主辦方發布活動並重新整理確認', async () => {
        progress('FLOW-09 發布活動');
        await organizerPage.goto(`/organizer/dash-board/activity/detail/${state.eventId}`);
        await expect(organizerPage.getByRole('button', { name: '發布活動', exact: true })).toBeVisible();
        await organizerPage.getByRole('button', { name: '發布活動', exact: true }).click();
        const publishPromise = waitForApi(
          organizerPage,
          `/api/organizer/events/${state.eventId}/publish`,
          'POST',
        );
        await organizerPage.getByRole('button', { name: '確定發布', exact: true }).click();
        await expectApiSuccess(await publishPromise);
        await closeAlert(organizerPage, '發布活動成功', '知道了');
        await organizerPage.reload();
        await expect(organizerPage.getByText(/已發布|報名中/).first()).toBeVisible();
        await demoPause(organizerPage);
      });

      await test.step('FLOW-10～11 一般使用者第一次查看活動與主辦方', async () => {
        progress('FLOW-10～11 公開活動');
        await publicPage.goto('/user/activity-list');
        await publicPage.getByPlaceholder('請輸入活動名稱或關鍵字').fill(eventName);
        const searchPromise = waitForApi(publicPage, '/api/markets/search', 'POST');
        await publicPage.getByRole('button', { name: '搜尋', exact: true }).click();
        await expectApiSuccess(await searchPromise);
        const activityCard = publicPage.locator('app-user-market-card', { hasText: eventName });
        await expect(activityCard).toBeVisible();
        await activityCard.click();
        await expect(publicPage).toHaveURL(/\/user\/activity-detail/);
        expect(new URL(publicPage.url()).searchParams.get('marketId')).toBe(String(state.eventId));
        await expect(publicPage.getByRole('heading', { name: eventName })).toBeVisible();
        await expect(publicPage.getByText(organizerName, { exact: true })).toBeVisible();
        await demoPause(publicPage);
      });

      await test.step('FLOW-12～15 攤主登入、儲存並重新載入我的攤位', async () => {
        progress('FLOW-12～15 我的攤位');
        await loginAndVerify(vendorPage, 'vendor', credentials!.vendor);
        const initialStallLoadPromise = waitForApi(vendorPage, '/api/vendor/stall/load', 'GET');
        await vendorPage.goto('/vendor/dash-board/myStall');
        await expect(vendorPage.getByRole('heading', { name: '我的攤位' })).toBeVisible();
        await initialStallLoadPromise;
        await fillVendorStall(vendorPage, brandName, productName, credentials!.vendor.email);

        const saveStallPromise = waitForApi(vendorPage, '/api/vendor/stall/save', 'POST');
        await vendorPage.locator('form.stall-form .save-btn').click();
        await expectApiSuccess(await saveStallPromise);
        await closeAlert(vendorPage, '儲存成功', '確定');

        // 首次建立攤位資料後，產品會把使用者導回後台首頁；
        // 明確回到我的攤位，再驗證 API 儲存內容可重新載入。
        const persistedStallPromise = waitForApi(vendorPage, '/api/vendor/stall/load', 'GET');
        await vendorPage.goto('/vendor/dash-board/myStall');
        await expect(vendorPage.getByRole('heading', { name: '我的攤位' })).toBeVisible();
        await expectApiSuccess(await persistedStallPromise);
        const reloadedStallPromise = waitForApi(vendorPage, '/api/vendor/stall/load', 'GET');
        await vendorPage.reload();
        await expectApiSuccess(await reloadedStallPromise);
        await expect(vendorPage.getByLabel('品牌名稱', { exact: false })).toHaveValue(brandName);
        await expect(vendorPage.getByRole('heading', { name: productName })).toBeVisible();
        await demoPause(vendorPage);
      });

      await test.step('FLOW-16～18 攤主帶設備資料報名並重新整理確認', async () => {
        progress('FLOW-16～18 攤主報名');
        await waitUntilRegistrationOpens(vendorPage, registrationOpensAt);
        await vendorPage.goto('/vendor/sign-up');
        await vendorPage.getByPlaceholder('請輸入活動名稱或關鍵字').fill(eventName);
        const marketSearchPromise = waitForApi(vendorPage, '/api/vendor/markets/search', 'POST');
        await vendorPage.getByRole('button', { name: '搜尋', exact: true }).click();
        await expectApiSuccess(await marketSearchPromise);

        const marketCard = vendorPage.locator('app-vendor-market-card', { hasText: eventName });
        await expect(marketCard).toBeVisible();
        await marketCard.click();
        await expect(vendorPage.getByRole('heading', { name: eventName })).toBeVisible();
        const signUpButton = vendorPage.locator('.signup-button');
        await expect(signUpButton).toBeEnabled();
        await signUpButton.click();

        await expect(vendorPage).toHaveURL('/vendor/sign-up-form');
        await expect(vendorPage.getByRole('heading', { name: eventName })).toBeVisible();
        const registrationDates = vendorPage.locator('.date-option input[type="checkbox"]');
        for (let index = 0; index < await registrationDates.count(); index += 1) {
          await registrationDates.nth(index).uncheck();
        }
        await registrationDates.first().check();
        await vendorPage.locator('.equipment-row input[type="checkbox"]').first().check();
        await vendorPage.getByLabel('需要申請額外用電', { exact: true }).check();
        await vendorPage.locator('.power-options input[type="checkbox"]').first().check();
        await vendorPage.getByLabel('有', { exact: true }).check();
        await vendorPage.getByPlaceholder('請輸入車牌號碼（範例：ABC-1234）').fill(vehicleNo);
        await vendorPage.getByPlaceholder('請輸入內容（選填）').fill('主要販售苔球與原木植栽，希望安排鄰近走道且通風良好的攤位。');
        await vendorPage.getByRole('button', { name: /下一步，確認資料/ }).click();

        await expect(vendorPage).toHaveURL('/vendor/sign-up-confirm');
        await expect(vendorPage.getByRole('heading', { name: eventName })).toBeVisible();
        await expect(vendorPage.getByText(vehicleNo, { exact: true })).toBeVisible();
        await vendorPage.locator('label.agreement input[type="checkbox"]').check();
        const applicationPromise = waitForApi(vendorPage, '/api/vendor/applications', 'POST');
        await vendorPage.getByRole('button', { name: /確認送出報名申請/ }).click();
        const applicationBody = await expectApiSuccess<{
          applicationId?: number;
          applicationNo?: string;
          totalAmount?: number;
        }>(await applicationPromise);
        state.applicationId = Number(applicationBody.data?.applicationId);
        state.applicationNo = String(applicationBody.data?.applicationNo ?? '');
        state.expectedTotal = Number(applicationBody.data?.totalAmount ?? 0);
        expect(state.applicationId).toBeGreaterThan(0);
        expect(state.applicationNo).toBeTruthy();
        expect(state.expectedTotal).toBeGreaterThan(0);

        await expect(vendorPage).toHaveURL('/vendor/sign-up-complete');
        await expect(vendorPage.getByText(eventName, { exact: true })).toBeVisible();
        await demoPause(vendorPage);
      });

      await test.step('FLOW-19～21 主辦方核對完整報名資料並核准', async () => {
        progress('FLOW-19～21 核准攤主');
        await organizerPage.goto(
          `/organizer/dash-board/register/detail/${state.applicationId}`,
        );
        await expect(organizerPage.getByRole('heading', { name: '報名詳情' })).toBeVisible();
        await expect(organizerPage.getByText(eventName, { exact: true })).toBeVisible();
        await expect(organizerPage.getByText(brandName, { exact: true })).toBeVisible();
        await expect(organizerPage.getByText(vehicleNo, { exact: true })).toBeVisible();
        await expect(organizerPage.getByText('六尺木紋展示桌', { exact: false })).toBeVisible();
        await expect(organizerPage.getByText('高功率餐飲設備用電', { exact: false })).toBeVisible();

        await organizerPage.locator('.header-actions .detail-status-action', { hasText: '審核通過' }).click();
        const approveApplicationPromise = waitForApi(
          organizerPage,
          `/api/organizer/applications/${state.applicationId}/approve`,
          'POST',
        );
        await organizerPage.getByRole('button', { name: '確認通過', exact: true }).click();
        await expectApiSuccess(await approveApplicationPromise);
        await closeAlert(organizerPage, '送出審核成功', '知道了');
        await expect(organizerPage.getByText('待付款', { exact: true }).first()).toBeVisible();
        await demoPause(organizerPage);
      });

      await test.step('FLOW-22～23 攤主確認待付款狀態與費用總額', async () => {
        progress('FLOW-22～23 付款金額');
        await vendorPage.goto(
          `/vendor/dash-board/application-record/detail/${state.applicationId}`,
        );
        await expect(vendorPage.getByText('待付款', { exact: true }).first()).toBeVisible();
        await expect(vendorPage.locator('.pay-now-btn')).toBeVisible();
        await vendorPage.reload();
        await expect(vendorPage.getByText('待付款', { exact: true }).first()).toBeVisible();
        await vendorPage.locator('.pay-now-btn').click();

        await expect(vendorPage).toHaveURL(
          new RegExp(`/vendor/dash-board/application-record/detail/${state.applicationNo}/payment`),
        );
        await expect(vendorPage.getByRole('heading', { name: '付款頁面' })).toBeVisible();
        const feeAmountRows = vendorPage.locator('.fee-list dd');
        await expect(feeAmountRows.first()).toBeVisible();
        const feeAmounts = await feeAmountRows.allTextContents();
        const calculatedTotal = feeAmounts.reduce((sum, value) => sum + parseCurrency(value), 0);
        const displayedTotal = parseCurrency(
          await vendorPage.locator('.total-row strong').textContent(),
        );
        expect(calculatedTotal).toBe(displayedTotal);
        expect(displayedTotal).toBe(state.expectedTotal);
        await demoPause(vendorPage, 1200);
      });

      await test.step('FLOW-24～25 藍新 Sandbox 付款並重新載入確認', async () => {
        progress('FLOW-24 藍新 Sandbox');
        let gatewayFailure: string | undefined;
        const captureGatewayFailure = (request: { url(): string; failure(): { errorText: string } | null }) => {
          if (/ccore\.newebpay\.com\/MPG\/mpg_gateway/.test(request.url())) {
            gatewayFailure = request.failure()?.errorText ?? 'unknown network error';
          }
        };
        vendorPage.on('requestfailed', captureGatewayFailure);
        const paymentPromise = waitForApi(vendorPage, '/api/vendor/payments/newebpay', 'POST');
        await vendorPage.locator('.credit-card .app-btn.primary').click();
        const paymentResponse = await paymentPromise;
        // 成功回應後前端會立刻以表單導向藍新；跨網域導頁可能讓 Chromium
        // 先釋放原 API response body，因此此處只驗證 HTTP 狀態。付款內容
        // 會再由藍新頁面與返回後的付款狀態共同驗證。
        expect(
          paymentResponse.ok(),
          `${paymentResponse.request().method()} ${paymentResponse.url()}`,
        ).toBe(true);
        try {
          await expect(vendorPage).toHaveURL(/ccore\.newebpay\.com/, { timeout: 30_000 });
        } catch (error) {
          if (gatewayFailure || vendorPage.url().startsWith('chrome-error://')) {
            throw new Error(
              `藍新 Sandbox 付款頁無法載入（${gatewayFailure ?? 'browser navigation failed'}）；`
              + '付款建立 API 已成功，請確認藍新測試站、商店權限或來源 IP 未被 Akamai 阻擋。',
              { cause: error },
            );
          }
          throw error;
        } finally {
          vendorPage.off('requestfailed', captureGatewayFailure);
        }
        await vendorPage.waitForLoadState('domcontentloaded');
        await vendorPage.waitForTimeout(3_000);

        const paymentPageText = await vendorPage.locator('body').innerText();
        if (/Access Denied|permission to access/i.test(paymentPageText)) {
          throw new Error(
            '藍新 Sandbox 的 Akamai 防護拒絕付款頁 POST（Access Denied）；付款建立 API 與 HTTPS gateway 已成功，需由藍新解除測試商店或來源 IP 限制後重跑。',
          );
        }

        await fillNewebPaySandboxCard(vendorPage, credentials!.vendor.email);
        const returnUrlPattern = new RegExp(
          `/vendor/dash-board/application-record/detail/${state.applicationNo}/payment`,
        );
        const agreementCheckboxes = vendorPage.locator('input[type="checkbox"]:visible');
        const agreementCount = await agreementCheckboxes.count();
        expect(agreementCount, '藍新付款頁應顯示訂單確認與服務條款勾選欄位').toBeGreaterThanOrEqual(2);
        for (let index = 0; index < agreementCount; index += 1) {
          await agreementCheckboxes.nth(index).check();
        }
        let gatewayDialog = 'none';
        vendorPage.once('dialog', async (dialog) => {
          gatewayDialog = `${dialog.type()}: ${dialog.message()}`;
          await dialog.accept();
        });
        const submitText = vendorPage.getByText('確認送出', { exact: true });
        await submitText.click();
        await vendorPage.waitForTimeout(2_000);
        if (gatewayDialog.startsWith('alert:')) {
          throw new Error(`藍新付款資料驗證失敗：${gatewayDialog.slice('alert:'.length).trim()}`);
        }
        await expect(vendorPage).toHaveURL(returnUrlPattern, { timeout: 90_000 });

        const paymentResultDialog = vendorPage.getByRole('dialog');
        await expect(paymentResultDialog).toContainText('付款成功');
        await paymentResultDialog.getByRole('button', { name: '查看報名詳情' }).click();
        await expect(vendorPage).toHaveURL(
          new RegExp(`/vendor/dash-board/application-record/detail/${state.applicationId}`),
        );
        await expect(vendorPage.getByText(/已付款|付款成功/).first()).toBeVisible();
        await expect(vendorPage.getByText('待選位', { exact: true }).first()).toBeVisible();

        await vendorPage.reload();
        await expect(vendorPage.getByText(/已付款|付款成功/).first()).toBeVisible();
        await expect(vendorPage.getByText('待選位', { exact: true }).first()).toBeVisible();
        await demoPause(vendorPage);
      });

      await test.step('FLOW-26～28 攤主選位並確認完整報名結果', async () => {
        progress('FLOW-26～28 攤主選位');
        const stallMapPromise = waitForApi(
          vendorPage,
          `/api/vendor/stall-map/${state.applicationNo}`,
          'GET',
        );
        await vendorPage.goto(
          `/vendor/dash-board/application-record/detail/${state.applicationNo}/booth?applicationId=${state.applicationId}`,
        );
        let stallMapBody = await expectApiSuccess<{
          stalls?: Array<{ stallNo?: string; status?: string; selectedApplicationId?: number | null }>;
        }>(await stallMapPromise);
        const activityDates = await vendorPage.locator('.day-result > strong').allTextContents();
        expect(activityDates.length).toBeGreaterThan(0);
        for (let index = 0; index < activityDates.length; index += 1) {
          if (index > 0) {
            const nextMapPromise = waitForApi(
              vendorPage,
              `/api/vendor/stall-map/${state.applicationNo}`,
              'GET',
            );
            const dateDropdown = vendorPage.locator('.date-filter app-dropdown');
            await dateDropdown.locator('.select-btn').click();
            await dateDropdown.getByRole('option', { name: activityDates[index], exact: true }).click();
            stallMapBody = await expectApiSuccess<{
              stalls?: Array<{ stallNo?: string; status?: string; selectedApplicationId?: number | null }>;
            }>(await nextMapPromise);
          }

          const availableStall = stallMapBody.data?.stalls?.find((stall) =>
            Boolean(stall.stallNo)
            && stall.selectedApplicationId == null
            && /AVAILABLE|可選/.test(String(stall.status ?? '').toUpperCase()),
          );
          const stallNo = String(availableStall?.stallNo ?? '');
          expect(stallNo).toBeTruthy();
          if (!state.selectedStallNo) state.selectedStallNo = stallNo;

          const selectedBooth = vendorPage.locator(`#market-booth-${stallNo}`);
          await expect(selectedBooth).toHaveAttribute('role', 'button');
          await selectedBooth.click();
          await expect(vendorPage.getByText(stallNo, { exact: true }).last()).toBeVisible();
        }
        await vendorPage.getByRole('button', { name: '完成攤位選擇' }).click();

        const selectPromise = waitForApi(vendorPage, '/api/stalls/select', 'POST');
        await vendorPage.getByRole('button', { name: '確認完成選位' }).click();
        await expectApiSuccess(await selectPromise);
        const selectionDialog = vendorPage.getByRole('dialog');
        await expect(selectionDialog).toContainText('已完成攤位選擇');
        await selectionDialog.getByRole('button', { name: '返回報名詳情' }).click();

        await expect(vendorPage.getByText('報名完成', { exact: true }).first()).toBeVisible();
        await expect(vendorPage.getByText(state.selectedStallNo, { exact: true }).first()).toBeVisible();
        await expect(vendorPage.getByText(vehicleNo, { exact: true })).toBeVisible();
        await vendorPage.reload();
        await expect(vendorPage.getByText('報名完成', { exact: true }).first()).toBeVisible();
        await expect(vendorPage.getByText(state.selectedStallNo, { exact: true }).first()).toBeVisible();
        await demoPause(vendorPage);
      });

      await test.step('FLOW-29 主辦方確認收款結果', async () => {
        progress('FLOW-29 主辦方收款');
        const collectionPromise = waitForApi(
          organizerPage,
          `/api/organizer/payments/${state.applicationId}`,
          'GET',
        );
        await organizerPage.goto(
          `/organizer/dash-board/collection/detail/${state.applicationId}`,
        );
        await expectApiSuccess(await collectionPromise);
        await expect(organizerPage.getByRole('heading', { name: '收款詳情' })).toBeVisible();
        await expect(organizerPage.getByText(eventName, { exact: true })).toBeVisible();
        await expect(organizerPage.getByText(/已付款|付款成功/).first()).toBeVisible();
        await expect(organizerPage.getByText(formatCurrencyForUi(state.expectedTotal)).first()).toBeVisible();
        await demoPause(organizerPage);
      });

      await test.step('FLOW-30 主辦方確認設備、用電與車牌', async () => {
        progress('FLOW-30 主辦方設備');
        const equipmentPromise = waitForApi(
          organizerPage,
          `/api/organizer/equipment/${state.eventId}`,
          'GET',
        );
        await organizerPage.goto(`/organizer/dash-board/equipment/detail/${state.eventId}`);
        await expectApiSuccess(await equipmentPromise);
        await expect(organizerPage.getByRole('heading', { name: '設備詳情' })).toBeVisible();
        await expect(organizerPage.getByText(brandName, { exact: true }).first()).toBeVisible();
        await expect(organizerPage.getByText('六尺木紋展示桌', { exact: true }).first()).toBeVisible();
        await expect(organizerPage.getByText('額外用電', { exact: true }).first()).toBeVisible();
        await expect(organizerPage.getByText('110V/1000w', { exact: true }).first()).toBeVisible();
        await expect(organizerPage.getByText(vehicleNo, { exact: true })).toBeVisible();
        await expect(organizerPage.getByText(state.selectedStallNo, { exact: true }).first()).toBeVisible();
        await demoPause(organizerPage);
      });

      await test.step('FLOW-31 主辦方從活動地圖確認攤位與品牌', async () => {
        progress('FLOW-31 主辦方攤位地圖');
        const organizerMapPromise = waitForApi(
          organizerPage,
          `/api/organizer/stall/${state.eventId}`,
          'GET',
        );
        await organizerPage.goto(
          `/organizer/dash-board/stall/detail/${state.eventId}/map?applyDate=${toInputDate(eventStartsAt)}`,
        );
        await expectApiSuccess(await organizerMapPromise);
        await expect(organizerPage.getByRole('heading', { name: '攤位地圖' })).toBeVisible();
        const organizerBooth = organizerPage.getByRole('button', {
          name: new RegExp(`${state.selectedStallNo}.*${escapeRegExp(brandName)}`),
        });
        await expect(organizerBooth).toBeVisible();
        await organizerBooth.click();
        await expect(organizerPage.getByText(brandName, { exact: true }).last()).toBeVisible();
        await demoPause(organizerPage, 1200);
      });

      await test.step('FLOW-32～34 一般使用者再次查看公開活動與攤商', async () => {
        progress('FLOW-32～34 公開活動結果');
        await waitUntilBrandsPublic(publicPage, state.eventId, registrationEndsAt);
        await publicPage.goto('/user/activity-list');
        await publicPage.getByPlaceholder('請輸入活動名稱或關鍵字').fill(eventName);
        const publicSearchPromise = waitForApi(publicPage, '/api/markets/search', 'POST');
        await publicPage.getByRole('button', { name: '搜尋', exact: true }).click();
        await expectApiSuccess(await publicSearchPromise);
        const activityCard = publicPage.locator('app-user-market-card', { hasText: eventName });
        await expect(activityCard).toBeVisible();
        await activityCard.click();

        const publicMapPromise = waitForApi(
          publicPage,
          `/api/eventsMap/${state.eventId}/stallsStatus`,
          'GET',
        );
        await expect(publicPage.getByRole('heading', { name: eventName })).toBeVisible();
        await expectApiSuccess(await publicMapPromise);
        const publicBooth = publicPage.locator(`#market-booth-${state.selectedStallNo}`);
        await expect(publicBooth).toBeVisible();
        const brandDetailPromise = waitForApi(
          publicPage,
          `/api/markets/${state.eventId}`,
          'GET',
        );
        await publicBooth.click();
        await expectApiSuccess(await brandDetailPromise);
        await expect(publicBooth).toHaveAttribute(
          'aria-label',
          `${state.selectedStallNo} ${brandName}`,
        );
        const publicBrandPreview = publicPage.locator('.booth-preview-fo.is-pinned');
        await expect(publicBrandPreview).toBeVisible();
        await expect(publicBrandPreview.getByText(brandName, { exact: true })).toBeVisible();
        await expect(publicPage.getByText(credentials!.vendor.email, { exact: true })).toHaveCount(0);
        await expect(publicPage.getByText(vehicleNo, { exact: true })).toHaveCount(0);
        await expect(publicPage.getByText('六尺木紋展示桌', { exact: true })).toHaveCount(0);

        await publicBrandPreview.getByRole('link', { name: '查看品牌' }).click();
        await publicPage.getByPlaceholder('請輸入品牌名稱或關鍵字').fill(brandName);
        const brandSearchPromise = waitForApi(publicPage, '/api/brands/search', 'GET');
        await publicPage.getByRole('button', { name: '搜尋', exact: true }).click();
        await expectApiSuccess(await brandSearchPromise);
        const brandCard = publicPage.locator('app-user-brandserch-card', { hasText: brandName });
        await expect(brandCard).toBeVisible();
        const publicBrandDetailPromise = publicPage.waitForResponse((response) =>
          /\/api\/brands\/\d+(?:\?|$)/.test(response.url())
          && response.request().method() === 'GET',
        );
        await brandCard.click();
        await expectApiSuccess(await publicBrandDetailPromise);
        await expect(publicPage.getByRole('heading', { name: brandName })).toBeVisible();
        await expect(publicPage.getByText(productName, { exact: true })).toBeVisible();
        await demoPause(publicPage, 1200);
      });
    } finally {
      await Promise.all([
        organizerContext.close(),
        adminContext.close(),
        vendorContext.close(),
        publicContext.close(),
      ]);
    }
  });
});

function requiredCredentials():
  | Record<AuthRole, { email: string; password: string }>
  | null {
  const result = {} as Record<AuthRole, { email: string; password: string }>;
  for (const config of authRoleCases) {
    const credentials = getCredentials(config);
    if (!credentials.email || !credentials.password) return null;
    result[config.role] = { email: credentials.email, password: credentials.password };
  }
  return result;
}

async function loginAndVerify(
  page: Page,
  role: AuthRole,
  credentials: { email: string; password: string },
): Promise<void> {
  const config = authRoleCases.find((item) => item.role === role)!;
  const response = await loginWithUi(page, config, credentials.email, credentials.password);
  const body = await expectApiSuccess<{ user?: { role?: string } }>(response);
  expect(body.data?.user?.role).toBe(config.expectedApiRole);
  await expect(page).toHaveURL(config.dashboardPath);
}

async function openOrganizerProfile(page: Page): Promise<void> {
  const userMenuButton = page.locator('.user-box');
  await expect(userMenuButton).toBeVisible();
  await userMenuButton.click();
  await expect(userMenuButton).toHaveAttribute('aria-expanded', 'true');
  const loadPromise = waitForApi(page, '/api/organizer/profile/load', 'GET');
  // 主辦方資料是選單第一項；使用結構定位，避免 Bootstrap 圖示字型
  // 被瀏覽器算進 accessible name 後，精確文字定位失效。
  const profileButton = page.locator('.user-menu .user-menu-item').first();
  await expect(profileButton).toBeVisible();
  await profileButton.click();
  await expectApiSuccess(await loadPromise);
  await expect(page.locator('.organizer-profile-modal')).toBeVisible();
}

async function fillOrganizerProfile(
  page: Page,
  organizerName: string,
  organizerEmail: string,
): Promise<void> {
  const dialog = page.locator('.organizer-profile-modal');
  await dialog.locator('input[name="organizerName"]').fill(organizerName);
  await dialog.locator('input[name="contactName"]').fill('林沐晴');
  await dialog.locator('input[name="contactPhone"]').fill('0928613745');
  await dialog.locator('input[name="contactEmail"]').fill(organizerEmail);
  await dialog.locator('input[name="companyName"]').fill('沐日整合行銷有限公司');
  await dialog.locator('input[name="taxId"]').fill('');
  await chooseDropdown(dialog.locator('app-dropdown').nth(0), '台北市');
  await chooseDropdown(dialog.locator('app-dropdown').nth(1), '中正區');
  await dialog.locator('input[name="address"]').fill('松江路 123 號 5 樓');
  const monday = dialog.locator('input[name="weekday週一"]');
  if (!(await monday.isChecked())) await monday.check();
  await dialog.locator('input[name="serviceStartTime"]').fill('09:00');
  await dialog.locator('input[name="serviceEndTime"]').fill('18:00');
}

async function fillVendorStall(
  page: Page,
  brandName: string,
  productName: string,
  vendorEmail: string,
): Promise<void> {
  await page.getByLabel('品牌名稱', { exact: false }).fill(brandName);
  await page.getByLabel('負責人姓名', { exact: false }).fill('陳雨森');
  await page.getByLabel('聯絡電話', { exact: false }).fill('0918276435');
  await page.getByLabel('Email', { exact: false }).fill(vendorEmail);
  await page.getByLabel('Instagram', { exact: false }).fill('shanmi.botanical');
  await page.getByLabel('Facebook 粉絲專頁', { exact: false }).fill('山眠植作 Shanmi Botanical');
  await page.getByLabel('詳細地址', { exact: false }).fill('迪化街一段 127 號');
  await page.getByLabel('官方網站', { exact: false }).fill('');

  const basicCard = page.locator('.stall-card').first();
  await chooseDropdown(basicCard.locator('app-dropdown').nth(0), '台北市');
  await chooseDropdown(basicCard.locator('app-dropdown').nth(1), '中正區');
  await page.locator('textarea[name="brandDescription"]').fill(
    '以苔球、原木與自然素材創作療癒植栽，希望把森林的安定感帶進日常生活。',
  );
  await chooseDropdown(page.locator('.brand-grid app-dropdown'), '文創手作');

  await setBrandImage(page, '品牌大頭貼', brandImagePath);
  await setBrandImage(page, '品牌封面', brandImagePath);

  const products = page.locator('.product-item');
  if ((await products.count()) > 0) {
    await products.first().getByRole('button', { name: /^編輯 / }).click();
    const dialog = page.locator('.vendor-product-modal');
    await dialog.getByPlaceholder('請輸入商品名稱').fill(productName);
    await dialog.getByPlaceholder('請輸入價格').fill('100');
    await dialog.getByPlaceholder('請簡單介紹你的商品特色').fill('選用台灣原木與耐陰植物製作，每件作品皆為手工搭配。');
    await dialog.locator('.app-modal-actions .primary').click();
    await expect(dialog).toBeHidden();
  } else {
    await page.locator('.add-product-btn').click();
    const dialog = page.locator('.vendor-product-modal');
    await dialog.getByPlaceholder('請輸入商品名稱').fill(productName);
    await dialog.getByPlaceholder('請輸入價格').fill('100');
    await dialog.getByPlaceholder('請簡單介紹你的商品特色').fill('選用台灣原木與耐陰植物製作，每件作品皆為手工搭配。');
    await dialog.locator('input[type="file"]').setInputFiles(productImagePath);
    await dialog.locator('.app-modal-actions .primary').click();
    await expect(dialog).toBeHidden();
  }
}

async function setBrandImage(page: Page, label: string, path: string): Promise<void> {
  const replaceInput = page.getByLabel(`重新選擇${label}`);
  if ((await replaceInput.count()) > 0) {
    await replaceInput.setInputFiles(path);
    return;
  }
  await page.getByLabel(`上傳${label}`).setInputFiles(path);
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

async function waitUntilRegistrationOpens(page: Page, opensAt: Date): Promise<void> {
  const remaining = opensAt.getTime() - Date.now() + 2_000;
  if (remaining > 0) {
    await page.waitForTimeout(remaining);
  }
}

async function waitUntilBrandsPublic(
  page: Page,
  eventId: number,
  registrationEndsAt: Date,
): Promise<void> {
  const timeout = Math.max(
    30_000,
    registrationEndsAt.getTime() - Date.now() + 2 * 60 * 1000,
  );
  await expect.poll(async () => {
    const response = await page.request.get(`${apiBaseUrl}/api/markets/${eventId}`);
    if (!response.ok()) return false;
    const body = (await response.json()) as ApiEnvelope<{ brandsPublic?: boolean }>;
    return body.statusCode != null
      && body.statusCode >= 200
      && body.statusCode < 300
      && body.data?.brandsPublic === true;
  }, {
    message: '報名截止並完成每分鐘自動選位後，公開 API 應開放品牌與攤位地圖',
    timeout,
    intervals: [1_000, 2_000, 5_000],
  }).toBe(true);
}

async function demoPause(page: Page, milliseconds = 800): Promise<void> {
  if (isDemo) await page.waitForTimeout(milliseconds);
}

/**
 * 藍新付款頁由第三方維護，欄位名稱可能隨版本調整；以 id、name、placeholder、
 * autocomplete 與鄰近文字辨識，不把單一版面的 CSS class 寫死在主流程。
 */
async function fillNewebPaySandboxCard(page: Page, email: string): Promise<void> {
  // 藍新 Sandbox 測試卡：4000-2211-1111-1111，可測一次付清與分期付款。
  // 有效年月只需為未來日期；每次執行時動態產生，避免固定年份過期。
  const expiry = createFutureCardExpiry();
  const inputs = page.locator('input:not([type="hidden"]):visible');
  const descriptors = await inputs.evaluateAll((elements) => elements.map((element) => {
    const input = element as HTMLInputElement;
    return [
      input.id,
      input.name,
      input.placeholder,
      input.autocomplete,
      input.getAttribute('aria-label') ?? '',
      input.parentElement?.innerText ?? '',
    ].join(' ');
  }));

  const findInput = (pattern: RegExp): Locator | null => {
    const index = descriptors.findIndex((descriptor) => pattern.test(descriptor));
    return index >= 0 ? inputs.nth(index) : null;
  };
  const fillIfPresent = async (pattern: RegExp, value: string): Promise<boolean> => {
    const input = findInput(pattern);
    if (!input) return false;
    await input.fill(value);
    return true;
  };

  const cardParts = page.locator(
    '#card1:visible, #card2:visible, #card3:visible, #card4:visible, '
    + 'input[name="card1"]:visible, input[name="card2"]:visible, input[name="card3"]:visible, input[name="card4"]:visible',
  );
  const cardPartValues = newebPaySandboxCardNumber.match(/.{4}/g)!;
  if ((await cardParts.count()) === 4) {
    for (const [index, value] of cardPartValues.entries()) {
      // 藍新頁面依逐字鍵盤事件更新四段卡號的內部狀態，不能只設定 input value。
      await cardParts.nth(index).type(value, { delay: 80 });
    }
  } else if (!(await fillIfPresent(
    /card.?no|card.?number|credit.?card|信用卡號|卡號/i,
    newebPaySandboxCardNumber,
  ))) {
    throw new Error(`無法辨識藍新信用卡號欄位；目前可見欄位：${descriptors.join(' | ')}`);
  }

  const expiryFilled = await fillIfPresent(
    /expire|expiry|expiration|有效期限|月\s*[／/]\s*年|mm\s*[／/]\s*yy/i,
    expiry.combined,
  );
  if (!expiryFilled) {
    const monthFilled = await fillIfPresent(/exp.*month|month|到期月|有效月/i, expiry.month);
    const yearFilled = await fillIfPresent(/exp.*year|year|到期年|有效年/i, expiry.year);
    if (!monthFilled || !yearFilled) {
      throw new Error(`無法辨識藍新卡片有效期限欄位；目前可見欄位：${descriptors.join(' | ')}`);
    }
  }

  if (!(await fillIfPresent(
    /cvc|cvv|security.?code|背面末三碼|安全碼/i,
    newebPaySandboxSecurityCode,
  ))) {
    throw new Error(`無法辨識藍新信用卡安全碼欄位；目前可見欄位：${descriptors.join(' | ')}`);
  }

  await fillIfPresent(/card.?holder|holder.?name|持卡人姓名|持卡人/i, 'LIN MU QING');
  await fillIfPresent(/e-?mail|電子郵件|信箱/i, email);
  await fillIfPresent(/mobile|phone|手機/i, '0928613745');
}

function createFutureCardExpiry(): { month: string; year: string; combined: string } {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 2);
  const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
  const year = String(expiryDate.getFullYear()).slice(-2);
  return { month, year, combined: `${month}${year}` };
}

function createUniqueVehicleNo(): string {
  const seed = randomUUID().replaceAll('-', '');
  const letters = [0, 2, 4]
    .map((index) => String.fromCharCode(65 + (Number.parseInt(seed.slice(index, index + 2), 16) % 26)))
    .join('');
  const digits = String(Number.parseInt(seed.slice(6, 14), 16) % 10_000).padStart(4, '0');
  return `${letters}-${digits}`;
}

function createNaturalEventName(baseName: string): string {
  const seed = randomUUID().replaceAll('-', '');
  const atmospheres = ['晨光', '森野', '花間', '海風', '山嵐', '暖日', '月光', '微風'];
  const themes = ['植感', '手作', '選物', '食光', '漫遊', '好日', '拾光', '風格'];
  const sessions = ['午後場', '週末場', '草地場', '城市場', '限定場', '小旅行', '生活節', '散步日'];
  const pick = (items: readonly string[], offset: number): string =>
    items[Number.parseInt(seed.slice(offset, offset + 2), 16) % items.length];
  return `${baseName}・${pick(atmospheres, 0)}${pick(themes, 2)}${pick(sessions, 4)}`;
}

function parseCurrency(value: string | null): number {
  return Number((value ?? '').replace(/[^0-9.-]/g, ''));
}

function formatCurrencyForUi(value: number): string {
  return `$${value.toLocaleString('zh-TW')}`;
}

function toInputDate(value: Date): string {
  return formatDate(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roundUpToMinute(value: Date): Date {
  const result = new Date(value);
  result.setSeconds(0, 0);
  return result;
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

function progress(step: string): void {
  console.log(`[main-flow] ${step}`);
}
