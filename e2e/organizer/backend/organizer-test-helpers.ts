import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIResponse, Download, Locator, Page, Response } from '@playwright/test';
import { expect } from '../../fixtures';
import {
  authRoleCases,
  getCredentials,
  loginWithUi,
  type AuthRole,
  type AuthRoleCase,
} from '../../auth-test-helpers';

export interface E2eCredentials {
  email: string;
  password: string;
}

export interface ApiEnvelope<T = Record<string, unknown>> {
  statusCode?: number;
  message?: string;
  messageDetails?: string | null;
  data?: T;
}

export interface OrganizerEventSchedule {
  registrationStart: Date;
  registrationEnd: Date;
  eventStart: Date;
  eventEnd: Date;
}

export const desktopViewport = { width: 1440, height: 900 };
const eventCoverPath = resolve('src/assets/images/market/cards/market-card-01.png');
const eventMapPath = resolve('src/assets/images/market/cards/market-card-02.png');

export function roleConfig(role: AuthRole): AuthRoleCase {
  const config = authRoleCases.find((item) => item.role === role);
  if (!config) throw new Error(`找不到 ${role} 的 E2E 登入設定。`);
  return config;
}

export function credentialsFor(role: AuthRole): E2eCredentials | null {
  const credentials = getCredentials(roleConfig(role));
  return credentials.email && credentials.password
    ? { email: credentials.email, password: credentials.password }
    : null;
}

export async function loginAs(
  page: Page,
  role: AuthRole,
  credentialsOverride?: E2eCredentials,
): Promise<void> {
  const config = roleConfig(role);
  const credentials = credentialsOverride ?? credentialsFor(role);
  if (!credentials) {
    throw new Error(`缺少 ${config.emailEnv} 或 ${config.passwordEnv}。`);
  }

  const response = await loginWithUi(page, config, credentials.email, credentials.password);
  const body = await response.json() as ApiEnvelope;
  if (!response.ok() || body.statusCode == null || body.statusCode < 200 || body.statusCode >= 300) {
    throw new Error(
      `${config.label} Real API 登入失敗：${body.message ?? `HTTP ${response.status()}`}。`
      + `請確認 ${config.emailEnv}/${config.passwordEnv} 與後端目前連線資料庫中的`
      + '帳號、角色、Email 驗證及啟用狀態一致。',
    );
  }
  await expect(page).toHaveURL(config.dashboardPath);
}

export function waitForApi(
  page: Page,
  path: string | RegExp,
  method?: string,
): Promise<Response> {
  return page.waitForResponse((response) => {
    const pathMatched = typeof path === 'string'
      ? response.url().includes(path)
      : path.test(response.url());
    return pathMatched && (!method || response.request().method() === method);
  });
}

export async function expectApiSuccess<T = Record<string, unknown>>(
  response: Response | APIResponse,
): Promise<ApiEnvelope<T>> {
  const method = 'request' in response ? response.request().method() : 'GET';
  expect(response.ok(), `${method} ${response.url()}`).toBe(true);
  const contentType = response.headers()['content-type'] ?? '';
  if (!contentType.includes('application/json')) return {};

  let body: ApiEnvelope<T>;
  try {
    body = await response.json() as ApiEnvelope<T>;
  } catch (error) {
    // Chromium may release a completed response body while Angular is changing
    // routes. HTTP success is still reliable; callers that need data should use
    // page.request or assert the rendered page state instead.
    if (/No resource with given identifier found/i.test(String(error))) return {};
    throw error;
  }
  if (body.statusCode != null) {
    const diagnostic = [
      `${method} ${response.url()}`,
      body.message,
      body.messageDetails,
    ].filter(Boolean).join(' — ');
    expect(body.statusCode, diagnostic).toBeGreaterThanOrEqual(200);
    expect(body.statusCode, diagnostic).toBeLessThan(300);
  }
  return body;
}

/** 使用目前主辦方登入 Token 直接查詢 Real API，供跨頁資料一致性斷言使用。 */
export async function organizerApiGet(page: Page, path: string): Promise<APIResponse> {
  const token = await page.evaluate(() => localStorage.getItem('MarketDayToken_organizer'));
  expect(token, '主辦方登入後應保存 Token').toBeTruthy();
  const apiBaseUrl = (process.env['E2E_API_BASE_URL'] ?? 'http://localhost:8081').replace(/\/$/, '');
  return page.request.get(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** 讀取主辦方活動型列表的全部分頁，避免測試資料增加後只檢查第一頁。 */
export async function organizerApiGetAllEventItems<T>(page: Page, path: string): Promise<T[]> {
  const items: T[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const separator = path.includes('?') ? '&' : '?';
    const response = await organizerApiGet(
      page,
      `${path}${separator}page=${currentPage}&pageSize=10`,
    );
    const body = await expectApiSuccess<{
      events?: { items?: T[]; totalPages?: number };
    }>(response);
    items.push(...(body.data?.events?.items ?? []));
    totalPages = Math.max(1, Number(body.data?.events?.totalPages ?? 1));
    currentPage += 1;
  } while (currentPage <= totalPages);

  return items;
}

export async function openOrganizerProfile(page: Page): Promise<Locator> {
  const userMenuButton = page.locator('.user-box');
  await expect(userMenuButton).toBeVisible();
  await userMenuButton.click();
  await expect(userMenuButton).toHaveAttribute('aria-expanded', 'true');

  const loadPromise = waitForApi(page, '/api/organizer/profile/load', 'GET');
  await page.locator('.user-menu .user-menu-item').first().click();
  await expectApiSuccess(await loadPromise);

  const dialog = page.locator('.organizer-profile-modal');
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function chooseDropdown(dropdown: Locator, option: string): Promise<void> {
  await dropdown.locator('.select-btn').click();
  await dropdown.getByRole('option', { name: option, exact: true }).click();
}

export function uniqueLabel(prefix: string): string {
  const seed = randomUUID().replaceAll('-', '');
  const atmospheres = ['晨光', '森野', '花間', '海風', '山嵐', '暖日', '月光', '微風'];
  const themes = ['植感', '手作', '選物', '食光', '漫遊', '好日', '拾光', '風格'];
  const sessions = ['午後場', '週末場', '草地場', '城市場', '限定場', '小旅行', '生活節', '散步日'];
  const pick = (items: readonly string[], offset: number): string =>
    items[Number.parseInt(seed.slice(offset, offset + 2), 16) % items.length];
  return `${prefix}・${pick(atmospheres, 0)}${pick(themes, 2)}${pick(sessions, 4)}`;
}

export function uniqueVehicleNo(): string {
  const seed = randomUUID().replaceAll('-', '');
  const letters = [0, 2, 4]
    .map((index) => String.fromCharCode(65 + (Number.parseInt(seed.slice(index, index + 2), 16) % 26)))
    .join('');
  const digits = String(Number.parseInt(seed.slice(6, 14), 16) % 10_000).padStart(4, '0');
  return `${letters}-${digits}`;
}

export async function expectNonEmptyDownload(download: Download): Promise<void> {
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).not.toBe('');
  const path = await download.path();
  expect(path, '下載檔案應有暫存路徑').toBeTruthy();
  expect((await stat(path!)).size, download.suggestedFilename()).toBeGreaterThan(0);
}

export async function closeAlert(
  page: Page,
  title: string,
  buttonName: string,
): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(title);
  await dialog.getByRole('button', { name: buttonName, exact: true }).click();
}

export async function fillCompleteOrganizerEvent(
  page: Page,
  eventName: string,
  schedule: OrganizerEventSchedule = defaultOrganizerEventSchedule(),
  includeEquipment = true,
): Promise<void> {
  const { registrationStart, registrationEnd, eventStart, eventEnd } = schedule;
  await expect(page.getByRole('heading', { name: /建立活動|編輯活動/ })).toBeVisible();
  await expect(page.locator('input[name="eventName"]')).toBeEditable();

  await page.locator('input[name="eventName"]').fill(eventName);
  await page.locator('label.category-option', { hasText: '文創手作' }).locator('input').check();
  await page.locator('.cover-field input[type="file"]').setInputFiles(eventCoverPath);
  await page.locator('textarea[name="description"]').fill('集結手作設計、風格選物與在地甜點的週末生活市集。');
  await page.locator('textarea[name="introduction"]').fill('邀請喜愛生活美學的品牌與民眾，一起在午後散步、品嘗甜點並認識台灣獨立創作者。現場規劃手作體驗、親子休憩區及品牌交流活動。');
  await page.getByRole('button', { name: '下一步', exact: true }).click();

  await fillDateTime(page, 'eventStart', eventStart);
  await fillDateTime(page, 'eventEnd', eventEnd);
  await fillDateTime(page, 'registrationStart', registrationStart);
  await fillDateTime(page, 'registrationEnd', registrationEnd);
  await page.locator('input[name="metro"]').fill('無');
  await page.locator('input[name="bus"]').fill('搭乘 202、205 或 257 路公車至臺北科技大學站，步行約 3 分鐘');
  await page.locator('input[name="driving"]').fill('可停八德路一段停車場，步行約 5 分鐘抵達會場');
  await page.getByRole('button', { name: '下一步', exact: true }).click();

  const venuePanel = page.locator('.venue-location-grid');
  await chooseDropdown(venuePanel.locator('app-dropdown').nth(0), '台北市');
  await chooseDropdown(venuePanel.locator('app-dropdown').nth(1), '中正區');
  await page.locator('input[name="address"]').fill('八德路一段 1 號');
  await page.locator('input[name="venueName"]').fill('華山文創園區・東二館');
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
  await page.getByRole('button', { name: '下一步', exact: true }).click();

  if (!includeEquipment) {
    await page.getByLabel('不提供設備租借', { exact: true }).check();
    await page.getByLabel('不提供基本用電', { exact: true }).check();
    await page.getByLabel('不開放額外申請', { exact: true }).check();
    return;
  }

  await page.getByLabel('提供設備租借', { exact: true }).check();
  await page.getByRole('button', { name: '新增設備' }).click();
  const equipmentDialog = page.getByRole('dialog', { name: '新增設備' });
  await equipmentDialog.locator('input[name="equipmentName"]').fill('六尺木紋展示桌');
  await equipmentDialog.locator('input[name="equipmentUnit"]').fill('張');
  await equipmentDialog.locator('textarea[name="equipmentSpecification"]').fill('180 x 60 cm');
  await equipmentDialog.locator('input[name="equipmentFreeQuantity"]').fill('0');
  await equipmentDialog.getByLabel('開放租借', { exact: true }).check();
  await equipmentDialog.locator('input[name="equipmentRentalPrice"]').fill('100');
  await equipmentDialog.locator('input[name="equipmentRentalLimit"]').fill('2');
  await equipmentDialog.locator('input[name="equipmentDailyRentalQuantity"]').fill('10');
  await equipmentDialog.getByRole('button', { name: '確認新增' }).click();

  await page.getByLabel('提供基本用電', { exact: true }).check();
  await page.getByRole('button', { name: '新增基本用電' }).click();
  const basicPowerDialog = page.getByRole('dialog', { name: '新增基本用電' });
  await basicPowerDialog.locator('input[name="basicPowerVoltage"]').fill('110V');
  await basicPowerDialog.locator('input[name="basicPowerWattage"]').fill('500');
  await basicPowerDialog.locator('textarea[name="basicPowerDescription"]').fill('一般設備使用');
  await basicPowerDialog.getByRole('button', { name: '儲存', exact: true }).click();

  await page.getByLabel('開放額外申請', { exact: true }).check();
  await page.getByRole('button', { name: '新增用電方案' }).click();
  const extraPowerDialog = page.getByRole('dialog', { name: '新增用電方案' });
  await extraPowerDialog.locator('input[name="extraPowerVoltage"]').fill('110V');
  await extraPowerDialog.locator('input[name="extraPowerWattage"]').fill('1000');
  await extraPowerDialog.locator('input[name="extraPowerFee"]').fill('200');
  await extraPowerDialog.locator('textarea[name="extraPowerDescription"]').fill('高功率餐飲設備用電');
  await extraPowerDialog.getByRole('button', { name: '儲存', exact: true }).click();
}

export function registrationOpenSchedule(): OrganizerEventSchedule {
  const registrationStart = roundUpToMinute(new Date(Date.now() + 15_000));
  const registrationEnd = new Date(registrationStart.getTime() + 30 * 60 * 1000);
  const eventStart = new Date(registrationEnd.getTime() + 48 * 60 * 60 * 1000);
  return {
    registrationStart,
    registrationEnd,
    eventStart,
    eventEnd: new Date(eventStart.getTime() + 8 * 60 * 60 * 1000),
  };
}

export async function createPublishedOrganizerEvent(
  organizerPage: Page,
  adminPage: Page,
  eventName: string,
  schedule: OrganizerEventSchedule,
): Promise<number> {
  await organizerPage.goto('/organizer/dash-board/activity/detail');
  await fillCompleteOrganizerEvent(organizerPage, eventName, schedule, false);

  const createPromise = waitForApi(organizerPage, '/api/organizer/events', 'POST');
  const reviewPromise = waitForApi(
    organizerPage,
    /\/api\/organizer\/events\/\d+\/submit-review/,
    'POST',
  );
  await organizerPage.getByRole('button', { name: '送出審核', exact: true }).click();
  await organizerPage.getByRole('button', { name: '確定送出', exact: true }).click();
  const createBody = await expectApiSuccess(await createPromise);
  await expectApiSuccess(await reviewPromise);
  const eventId = Number((createBody.data as { eventId?: number } | undefined)?.eventId);
  expect(eventId, '建立活動 API 應回傳 eventId').toBeGreaterThan(0);
  await closeAlert(organizerPage, '送出審核成功', '知道了');

  await adminPage.goto(`/admin/dash-board/activity/detail/${eventId}`);
  await expect(adminPage.getByRole('heading', { name: eventName })).toBeVisible();
  await adminPage.locator('.header-actions button', { hasText: '審核通過' }).click();
  const approvePromise = waitForApi(adminPage, `/api/admin/events/${eventId}/approve`, 'POST');
  await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();
  await expectApiSuccess(await approvePromise);
  await closeAlert(adminPage, '審核通過', '確定');

  await adminPage.locator('.header-actions button', { hasText: '地圖建置完成' }).click();
  const mapPromise = waitForApi(adminPage, `/api/admin/events/${eventId}/map-complete`, 'POST');
  await adminPage.getByRole('button', { name: '確認送出', exact: true }).click();
  await expectApiSuccess(await mapPromise);
  await closeAlert(adminPage, '地圖建置已送出', '確定');

  await organizerPage.goto(`/organizer/dash-board/activity/detail/${eventId}`);
  await organizerPage.getByRole('button', { name: '發布活動', exact: true }).click();
  const publishPromise = waitForApi(
    organizerPage,
    `/api/organizer/events/${eventId}/publish`,
    'POST',
  );
  await organizerPage.getByRole('button', { name: '確定發布', exact: true }).click();
  await expectApiSuccess(await publishPromise);
  await closeAlert(organizerPage, '發布活動成功', '知道了');
  return eventId;
}

export async function submitVendorApplication(
  vendorPage: Page,
  eventName: string,
  registrationStart: Date,
  vehicleNo: string,
): Promise<number> {
  const remaining = registrationStart.getTime() - Date.now() + 2_000;
  if (remaining > 0) await vendorPage.waitForTimeout(remaining);

  await vendorPage.goto('/vendor/sign-up');
  await vendorPage.getByPlaceholder('請輸入活動名稱或關鍵字').fill(eventName);
  const searchPromise = waitForApi(vendorPage, '/api/vendor/markets/search', 'POST');
  await vendorPage.getByRole('button', { name: '搜尋', exact: true }).click();
  await expectApiSuccess(await searchPromise);
  const marketCard = vendorPage.locator('app-vendor-market-card', { hasText: eventName });
  await expect(marketCard).toBeVisible();
  await marketCard.click();
  await vendorPage.locator('.signup-button').click();

  await vendorPage.locator('.date-option input[type="checkbox"]').first().check();
  await vendorPage.getByLabel('有', { exact: true }).check();
  await vendorPage.getByPlaceholder('請輸入車牌號碼（範例：ABC-1234）').fill(vehicleNo);
  await vendorPage.getByPlaceholder('請輸入內容（選填）').fill('主要販售植物盆器與居家香氛，希望安排鄰近走道的攤位。');
  await vendorPage.getByRole('button', { name: /下一步，確認資料/ }).click();
  await vendorPage.locator('label.agreement input[type="checkbox"]').check();
  const applicationPromise = waitForApi(vendorPage, '/api/vendor/applications', 'POST');
  await vendorPage.getByRole('button', { name: /確認送出報名申請/ }).click();
  const body = await expectApiSuccess(await applicationPromise);
  const applicationId = Number((body.data as { applicationId?: number } | undefined)?.applicationId);
  expect(applicationId, '建立報名 API 應回傳 applicationId').toBeGreaterThan(0);
  await expect(vendorPage).toHaveURL('/vendor/sign-up-complete');
  return applicationId;
}

function defaultOrganizerEventSchedule(): OrganizerEventSchedule {
  const registrationStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const registrationEnd = new Date(registrationStart.getTime() + 24 * 60 * 60 * 1000);
  const eventStart = new Date(registrationEnd.getTime() + 24 * 60 * 60 * 1000);
  return {
    registrationStart,
    registrationEnd,
    eventStart,
    eventEnd: new Date(eventStart.getTime() + 8 * 60 * 60 * 1000),
  };
}

function roundUpToMinute(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  if (rounded.getTime() < date.getTime()) rounded.setMinutes(rounded.getMinutes() + 1);
  return rounded;
}

async function fillDateTime(page: Page, prefix: string, date: Date): Promise<void> {
  await page.locator(`input[name="${prefix}Date"]`).fill(formatDate(date));
  await page.locator(`input[name="${prefix}Time"]`).fill(formatTime(date));
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
