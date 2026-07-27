import type { APIResponse, Page } from '@playwright/test';

import { expect, test } from '../fixtures';

const isDemo = process.env['E2E_DEMO'] === '1';
const seededMarketTitle = '島嶼日和生活市集';
const seededHistoryMarketTitle = '春日野餐市集';
const seededSelectedBrandName = '日光小廚房';
const seededMarketLocation = {
  locationName: '審計新村368新創聚落',
  city: '台中市',
  district: '西區',
  address: '民生路368巷',
} as const;
const expectedMapBoothCodes = ([
  ['A', 28],
  ['B', 13],
  ['C', 9],
] as const).flatMap(([zone, count]) =>
  Array.from({ length: count }, (_, index) => `${zone}${String(index + 1).padStart(2, '0')}`),
);
const searchFilterNames = [
  'keyword',
  'city',
  'eventStatus',
  'startDate',
  'endDate',
  'categoryNames',
] as const;

interface ApiEnvelope<T> {
  statusCode: number;
  message: string;
  messageDetails: string | null;
  data: T;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface MarketCard {
  id: number;
  title: string;
  summary: string | null;
  locationName: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  startDate: string | null;
  endDate: string | null;
  coverImageUrl: string | null;
  categories: Category[];
  eventStatus: string;
}

interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

interface MarketOrganizer {
  organizerName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  serviceDays: string | null;
  serviceStartTime: string | null;
  serviceEndTime: string | null;
}

interface MarketDetail extends MarketCard {
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  organizer: MarketOrganizer | null;
  brandsPublic: boolean;
}

const isMarketSearchResponse = (response: APIResponse): boolean => {
  const url = new URL(response.url());
  return response.request().method() === 'POST' && url.pathname === '/api/markets/search';
};

const assertSuccessfulEnvelope = (response: APIResponse, statusCode: number): void => {
  expect(response.ok()).toBe(true);
  expect(statusCode).toBeGreaterThanOrEqual(200);
  expect(statusCode).toBeLessThan(300);
};

const displayDate = (value: string | null): string => value?.replace(/-/g, '/') ?? '';

const marketLocation = (market: MarketCard): string =>
  [market.city, market.district, market.locationName].filter(Boolean).join(' ');

async function openMarketList(page: Page): Promise<{
  response: APIResponse;
  body: ApiEnvelope<PageResponse<MarketCard>>;
}> {
  const responsePromise = page.waitForResponse(isMarketSearchResponse);
  await page.goto('/user/activity-list');
  await applyDemoZoom(page);
  const response = await responsePromise;
  const body = (await response.json()) as ApiEnvelope<PageResponse<MarketCard>>;
  return { response, body };
}

async function demoPause(page: Page, milliseconds = 900): Promise<void> {
  if (isDemo) {
    await page.waitForTimeout(milliseconds);
  }
}

async function applyDemoZoom(page: Page): Promise<void> {
  if (!isDemo) return;
  // Match the requested browser zoom: 100 → 90 → 80 → 75 percent.
  await page.keyboard.press('Control+0');
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press('Control+-');
  }
}

async function selectDropdownOption(page: Page, title: string, option: string): Promise<void> {
  const dropdown = page.locator('app-dropdown', { hasText: title }).first();
  await dropdown.locator('button.select-btn').click();
  await dropdown.getByRole('option', { name: option, exact: true }).click();
}

async function setDateField(page: Page, label: string, value: string): Promise<void> {
  const input = page.getByLabel(label);
  await input.click();
  await input.fill(value);
  await input.press('Tab');
  await expect(input).toHaveValue(value);
}

async function submitMarketSearch(page: Page): Promise<{
  response: APIResponse;
  body: ApiEnvelope<PageResponse<MarketCard>>;
  url: URL;
}> {
  const responsePromise = page.waitForResponse(isMarketSearchResponse);
  await page.getByRole('button', { name: '搜尋', exact: true }).click();
  const response = await responsePromise;
  if (isDemo) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  }
  await demoPause(page, 3_000);
  return {
    response,
    body: (await response.json()) as ApiEnvelope<PageResponse<MarketCard>>,
    url: new URL(response.url()),
  };
}

function expectSingleFilter(url: URL, name: typeof searchFilterNames[number], value: string): void {
  expect(url.searchParams.get('eventType')).toBe('目前活動');
  expect(url.searchParams.get(name)).toBe(value);
  expect(url.searchParams.get('page')).toBe('1');
  expect(url.searchParams.get('pageSize')).toBe('6');
  for (const otherName of searchFilterNames) {
    if (otherName !== name) {
      expect(url.searchParams.has(otherName)).toBe(false);
    }
  }
}

test.describe('一般使用者公開市集', () => {
  test.describe.configure({ timeout: isDemo ? 360_000 : 180_000 });

  test('@smoke @regression USER-MARKET-01/02/03 公開市集搜尋、詳情與地圖旅程', async ({ page }) => {
    const initial = await openMarketList(page);
    assertSuccessfulEnvelope(initial.response, initial.body.statusCode);
    expect(initial.body.data.totalItems).toBeGreaterThan(1);

    const filterCategories = ['餐飲美食', '文創手作', '親子家庭', '寵物生活', '植物選物', '服飾配件', '玩具選物'];
    for (const initialMarket of initial.body.data.items) {
      expect(initialMarket.title).not.toMatch(/E2E|TEST|Payment|Refund|測試/i);
      expect(initialMarket.categories.every((category) => filterCategories.includes(category.name))).toBe(true);
      const initialCard = page.locator('app-user-market-card', { hasText: initialMarket.title }).first();
      await expect(initialCard).toBeVisible();
      await expect(initialCard).not.toContainText(/E2E|TEST|Payment|Refund|測試/i);
      const image = initialCard.getByRole('img', { name: initialMarket.title, exact: true });
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
        .toBeGreaterThan(0);
    }
    await demoPause(page, 4_000);

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const tomorrowDate = new Date(`${today}T00:00:00Z`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const listPathname = new URL(page.url()).pathname;
    const navigationEntryCount = await page.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );

    const scenarios: Array<{
      label: string;
      queryName: typeof searchFilterNames[number];
      value: string;
      operate: () => Promise<void>;
      matches: (item: MarketCard) => boolean;
    }> = [
      {
        label: '縣市', queryName: 'city', value: seededMarketLocation.city,
        operate: () => selectDropdownOption(page, '縣市', seededMarketLocation.city),
        matches: (item) => item.city === seededMarketLocation.city,
      },
      {
        label: '活動狀態', queryName: 'eventStatus', value: '進行中',
        operate: () => selectDropdownOption(page, '活動狀態', '進行中'),
        matches: (item) => item.eventStatus === '進行中',
      },
      {
        label: '開始日期', queryName: 'startDate', value: today,
        operate: () => setDateField(page, '開始日期', today),
        matches: (item) => Boolean(item.endDate && item.endDate >= today),
      },
      {
        label: '結束日期', queryName: 'endDate', value: tomorrow,
        operate: () => setDateField(page, '結束日期', tomorrow),
        matches: (item) => Boolean(item.startDate && item.startDate <= tomorrow),
      },
      {
        label: '分類標籤', queryName: 'categoryNames', value: '餐飲美食',
        operate: () => page.getByRole('button', { name: /餐飲美食/ }).click(),
        matches: (item) => item.categories.some((category) => category.name === '餐飲美食'),
      },
      {
        label: '活動名稱', queryName: 'keyword', value: seededMarketTitle,
        operate: () => page.getByPlaceholder('請輸入活動名稱或關鍵字').fill(seededMarketTitle),
        matches: (item) => item.title === seededMarketTitle,
      },
    ];

    let marketForDetail: MarketCard | undefined;
    for (const [scenarioIndex, scenario] of scenarios.entries()) {
      const stepName = scenarioIndex === 0
        ? `最初直接使用${scenario.label}搜尋`
        : `清除上一條件後只使用${scenario.label}搜尋`;
      await test.step(stepName, async () => {
        if (scenarioIndex > 0) {
          const clearResponsePromise = page.waitForResponse(isMarketSearchResponse);
          await page.getByRole('button', { name: '清除條件', exact: true }).click();
          const clearResponse = await clearResponsePromise;
          const clearBody = (await clearResponse.json()) as ApiEnvelope<PageResponse<MarketCard>>;
          assertSuccessfulEnvelope(clearResponse, clearBody.statusCode);
          expect(clearBody.data.items.length).toBeGreaterThan(0);
        }

        await scenario.operate();
        await demoPause(page, 1_200);
        const result = await submitMarketSearch(page);
        assertSuccessfulEnvelope(result.response, result.body.statusCode);
        expectSingleFilter(result.url, scenario.queryName, scenario.value);
        expect(result.body.data.items.length).toBeGreaterThan(0);
        expect(result.body.data.items.every(scenario.matches)).toBe(true);
        await expect(page.locator('app-user-market-card').first()).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(listPathname);
        expect(await page.evaluate(() => performance.getEntriesByType('navigation').length))
          .toBe(navigationEntryCount);

        if (scenario.queryName === 'keyword') {
          expect(result.body.data.items).toHaveLength(1);
          marketForDetail = result.body.data.items[0];
          expect(marketForDetail.eventStatus).toBe('進行中');
        }
      });
    }

    expect(marketForDetail).toBeDefined();
    const market = marketForDetail!;
    const card = page.locator('app-user-market-card', { hasText: market.title }).first();
    await expect(card).toBeVisible();
    await demoPause(page, 3_000);

    const detailResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET'
        && url.pathname === `/api/markets/${market.id}`
        && !url.searchParams.has('date') && !url.searchParams.has('stallNo');
    });
    const detailUrlPromise = page.waitForURL(/\/user\/activity-detail\?/);
    await card.click();
    await detailUrlPromise;
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
    await expect(page.getByRole('heading', { name: market.title, exact: true })).toBeVisible();
    await demoPause(page, 5_000);

    const detailResponse = await detailResponsePromise;
    const detailBody = (await detailResponse.json()) as ApiEnvelope<MarketDetail>;
    const detail = detailBody.data;
    assertSuccessfulEnvelope(detailResponse, detailBody.statusCode);
    expect(detail.id).toBe(market.id);
    expect(detail.locationName).toBe(seededMarketLocation.locationName);
    expect(detail.city).toBe(seededMarketLocation.city);
    expect(detail.district).toBe(seededMarketLocation.district);
    expect(detail.address).toBe(seededMarketLocation.address);
    expect(new URL(page.url()).searchParams.get('marketId')).toBe(String(market.id));
    await expect(page.getByRole('heading', { name: detail.title, exact: true })).toBeVisible();
    const detailImage = page.locator('.market-image-wrap img');
    await expect.poll(() => detailImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);

    const infoCard = page.locator('.info-card');
    if (detail.startDate) await expect(infoCard).toContainText(displayDate(detail.startDate));
    if (detail.endDate) await expect(infoCard).toContainText(displayDate(detail.endDate));
    const location = marketLocation(detail);
    if (location) await expect(infoCard).toContainText(location);
    if (detail.address) await expect(infoCard).toContainText(detail.address);
    const description = detail.description ?? detail.summary;
    if (description) await expect(page.locator('.intro-card')).toContainText(description);
    if (detail.organizer?.organizerName) {
      await expect(page.locator('.bottom-info-grid')).toContainText(detail.organizer.organizerName);
    }

    const boothSection = page.locator('.booth-section');
    await boothSection.scrollIntoViewIfNeeded();
    await expect(boothSection.getByRole('heading', { name: '攤位地圖', exact: true })).toBeVisible();
    await expect(boothSection.locator('app-market-map')).toBeVisible();
    const roadLabels = await boothSection.locator('.map-canvas .road-label').evaluateAll((labels) =>
      labels.map((label) => label.textContent?.replace(/\s/g, '') ?? ''),
    );
    expect(roadLabels).toEqual(expect.arrayContaining(['中興街', '民生路']));
    const mapBooths = boothSection.locator('.map-canvas .booth[role="button"]:not(.booth-service)');
    await expect(mapBooths).toHaveCount(50);
    const renderedBoothCodes = await mapBooths.evaluateAll((booths) =>
      booths.map((booth) => booth.id.replace('market-booth-', '')).sort(),
    );
    expect(renderedBoothCodes).toEqual([...expectedMapBoothCodes].sort());
    expect(new Set(renderedBoothCodes).size).toBe(50);
    await expect(boothSection.locator('#market-booth-service-booth')).toHaveCount(1);
    await expect(boothSection.getByRole('button', { name: /A09/ }).first()).toBeVisible();
    await expect(boothSection.getByRole('button', { name: /B02/ }).first()).toBeVisible();
    await demoPause(page, 4_000);

    const selectedStallResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET'
        && url.pathname === `/api/markets/${market.id}`
        && url.searchParams.get('stallNo') === 'A09';
    });
    await boothSection.getByRole('button', { name: /A09/ }).first().click();
    const selectedStallResponse = await selectedStallResponsePromise;
    expect(selectedStallResponse.ok()).toBe(true);
    await expect(
      boothSection.locator('.selected-brand-card').getByRole('heading', {
        name: seededSelectedBrandName,
        exact: true,
      }),
    ).toBeVisible();
    const selectedBrandImage = boothSection.locator('.selected-brand-card .brand-identity img');
    await expect(selectedBrandImage).toBeVisible();
    await expect.poll(() => selectedBrandImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
    await demoPause(page, 4_000);

    const zoneTabs = boothSection.getByRole('tablist', { name: '品牌分區' });
    await expect(zoneTabs).toBeVisible();
    const directoryRows = boothSection.locator('.brand-directory-compact .directory-row');
    await zoneTabs.getByRole('tab', { name: '全部', exact: true }).click();
    await expect(boothSection.getByText('共 50 個攤位', { exact: true })).toBeVisible();
    await expect(directoryRows).toHaveCount(50);
    for (const [zone, count] of [['A區', 28], ['B區', 13], ['C區', 9]] as const) {
      await zoneTabs.getByRole('tab', { name: zone, exact: true }).click();
      await expect(boothSection.getByText(`共 ${count} 個攤位`, { exact: true })).toBeVisible();
      await expect(directoryRows).toHaveCount(count);
    }
    await zoneTabs.getByRole('tab', { name: '全部', exact: true }).click();
    await demoPause(page, 5_000);

    const sessions = await page.evaluate(() => ({
      vendor: localStorage.getItem('MarketDayToken_vendor'),
      organizer: localStorage.getItem('MarketDayToken_organizer'),
      admin: localStorage.getItem('MarketDayToken_admin'),
    }));
    expect(sessions).toEqual({ vendor: null, organizer: null, admin: null });
    await demoPause(page, 6_000);
    await page.close();
  });

  test('@regression USER-MARKET-04 可以切換並顯示歷史活動', async ({ page }) => {
    const current = await openMarketList(page);
    assertSuccessfulEnvelope(current.response, current.body.statusCode);

    const historyResponsePromise = page.waitForResponse(isMarketSearchResponse);
    await page.getByRole('button', { name: '歷史活動', exact: true }).click();
    const historyResponse = await historyResponsePromise;
    const historyBody = (await historyResponse.json()) as ApiEnvelope<PageResponse<MarketCard>>;
    assertSuccessfulEnvelope(historyResponse, historyBody.statusCode);
    expect(new URL(historyResponse.url()).searchParams.get('eventType')).toBe('歷史活動');
    expect(historyBody.data.items.some((item) => item.title === seededHistoryMarketTitle)).toBe(true);
    const seededHistoryMarket = historyBody.data.items.find(
      (item) => item.title === seededHistoryMarketTitle,
    );
    expect(seededHistoryMarket?.endDate).toBeTruthy();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    expect(Date.parse(seededHistoryMarket!.endDate!)).toBeLessThan(Date.parse(today));
    for (const historyMarket of historyBody.data.items) {
      expect(historyMarket.title).not.toMatch(/E2E|TEST|Payment|Refund|測試|退款/i);
      expect(historyMarket.summary ?? '').not.toMatch(/E2E|TEST|Payment|Refund|測試|退款/i);
      expect(historyMarket.categories.every((category) =>
        !/E2E|TEST|Payment|Refund|測試|退款/i.test(category.name))).toBe(true);
    }
    await expect(page).toHaveURL(/\/user\/activity-list\/history/);

    const historyCard = page.locator('app-user-history-market-card', {
      hasText: seededHistoryMarketTitle,
    }).first();
    await expect(historyCard).toBeVisible();
    const historyImage = historyCard.getByRole('img', { name: seededHistoryMarketTitle, exact: true });
    await expect.poll(() => historyImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
    await demoPause(page, 6_000);
  });
});
