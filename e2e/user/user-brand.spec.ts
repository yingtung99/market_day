import type { APIResponse, Page } from '@playwright/test';

import { expect, test } from '../fixtures';

const isDemo = process.env['E2E_DEMO'] === '1';
const seededBrandName = '日光小廚房';
const seededCategoryName = '餐飲美食';
const seededProductName = '蜂蜜檸檬氣泡飲';
const forbiddenPublicText = /E2E|TEST|Payment|Refund|測試|退款/i;
const searchFilterNames = ['keyword', 'categoryName', 'marketName'] as const;

interface ApiEnvelope<T> {
  statusCode: number;
  message: string;
  messageDetails: string | null;
  data: T;
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

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface BrandProductSummary {
  productId: number;
  productName: string;
}

interface BrandSummary {
  brandId: number;
  mainImageUrl: string | null;
  avatarImageUrl: string | null;
  brandName: string;
  brandSummary: string | null;
  participatedMarketCount: number;
  representativeProducts: BrandProductSummary[];
  category: Category | null;
}

interface BrandSearchData {
  totalCount: number;
  brands: PageResponse<BrandSummary>;
}

interface BrandProduct extends BrandProductSummary {
  productImageUrl: string | null;
  productPrice: number | null;
  productShortDescription: string | null;
}

interface ParticipatedMarket {
  eventId: number;
  eventTitle: string;
  eventStartAt: string | null;
  eventEndAt: string | null;
}

interface BrandLinks {
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
}

interface BrandDetail extends BrandSummary {
  brandDescription: string | null;
  representativeProducts: BrandProduct[];
  participatedMarkets: ParticipatedMarket[];
  links: BrandLinks;
}

const isBrandSearchResponse = (response: APIResponse): boolean => {
  const url = new URL(response.url());
  return response.request().method() === 'GET' && url.pathname === '/api/brands/search';
};

async function applyDemoZoom(page: Page): Promise<void> {
  if (!isDemo) return;
  await page.keyboard.press('Control+0');
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press('Control+-');
  }
}

async function demoPause(page: Page, milliseconds = 1_000): Promise<void> {
  if (isDemo) await page.waitForTimeout(milliseconds);
}

async function selectDropdownOption(page: Page, title: string, option: string): Promise<void> {
  const dropdown = page.locator('app-dropdown', { hasText: title }).first();
  await dropdown.locator('button.select-btn').click();
  await dropdown.getByRole('option', { name: option, exact: true }).click();
}

async function submitSearch(page: Page): Promise<{
  response: APIResponse;
  body: ApiEnvelope<BrandSearchData>;
  url: URL;
}> {
  const responsePromise = page.waitForResponse(isBrandSearchResponse);
  await page.getByRole('button', { name: '搜尋', exact: true }).click();
  const response = await responsePromise;
  const body = (await response.json()) as ApiEnvelope<BrandSearchData>;
  await demoPause(page, 3_000);
  return { response, body, url: new URL(response.url()) };
}

function assertSuccessfulEnvelope(response: APIResponse, statusCode: number): void {
  expect(response.ok()).toBe(true);
  expect(statusCode).toBeGreaterThanOrEqual(200);
  expect(statusCode).toBeLessThan(300);
}

function assertPagination(pageData: PageResponse<BrandSummary>): void {
  expect(Array.isArray(pageData.items)).toBe(true);
  expect(pageData.page).toBe(1);
  expect(pageData.pageSize).toBe(6);
  expect(typeof pageData.totalItems).toBe('number');
  expect(typeof pageData.totalPages).toBe('number');
  expect(typeof pageData.hasPrevious).toBe('boolean');
  expect(typeof pageData.hasNext).toBe('boolean');
}

function assertSingleFilter(
  url: URL,
  name: (typeof searchFilterNames)[number],
  value: string,
): void {
  expect(url.searchParams.get(name)).toBe(value);
  expect(url.searchParams.get('page')).toBe('1');
  expect(url.searchParams.get('pageSize')).toBe('6');
  for (const otherName of searchFilterNames) {
    if (otherName !== name) expect(url.searchParams.has(otherName)).toBe(false);
  }
}

test.describe('一般使用者品牌探索', () => {
  test.describe.configure({ timeout: isDemo ? 300_000 : 150_000 });

  test('@regression USER-BRAND-01/02/03 品牌列表、單欄位搜尋與詳情旅程', async ({ page }) => {
    const initialSearchPromise = page.waitForResponse(isBrandSearchResponse);
    await page.goto('/user/brands');
    await applyDemoZoom(page);

    const initialResponse = await initialSearchPromise;
    const initialBody = (await initialResponse.json()) as ApiEnvelope<BrandSearchData>;
    assertSuccessfulEnvelope(initialResponse, initialBody.statusCode);
    assertPagination(initialBody.data.brands);
    expect(initialBody.data.totalCount).toBe(initialBody.data.brands.totalItems);
    expect(initialBody.data.brands.items.length).toBeGreaterThan(1);

    for (const brand of initialBody.data.brands.items) {
      expect(brand.brandName).not.toMatch(forbiddenPublicText);
      expect(brand.brandSummary ?? '').not.toMatch(forbiddenPublicText);
      expect(brand.category?.name ?? '').not.toMatch(forbiddenPublicText);
      const card = page.locator('app-user-brandserch-card', { hasText: brand.brandName }).first();
      await expect(card).toBeVisible();
      await expect(card).not.toContainText(forbiddenPublicText);
      const images = card.getByRole('img', { name: brand.brandName, exact: true });
      await expect(images).toHaveCount(2);
      for (let imageIndex = 0; imageIndex < 2; imageIndex += 1) {
        await expect.poll(() => images.nth(imageIndex).evaluate(
          (element: HTMLImageElement) => element.naturalWidth,
        )).toBeGreaterThan(0);
      }
    }
    await demoPause(page, 4_000);

    await selectDropdownOption(page, '品牌類型', seededCategoryName);
    const categorySearch = await submitSearch(page);
    assertSuccessfulEnvelope(categorySearch.response, categorySearch.body.statusCode);
    assertSingleFilter(categorySearch.url, 'categoryName', seededCategoryName);
    expect(categorySearch.body.data.brands.items.length).toBeGreaterThan(0);
    expect(categorySearch.body.data.brands.items.every(
      (brand) => brand.category?.name === seededCategoryName,
    )).toBe(true);

    await selectDropdownOption(page, '品牌類型', '全部類型');
    const keywordInput = page.getByPlaceholder('請輸入品牌名稱或關鍵字');
    await keywordInput.fill(seededBrandName);
    const keywordSearch = await submitSearch(page);
    assertSuccessfulEnvelope(keywordSearch.response, keywordSearch.body.statusCode);
    assertSingleFilter(keywordSearch.url, 'keyword', seededBrandName);
    expect(keywordSearch.body.data.brands.totalItems).toBe(1);
    expect(keywordSearch.body.data.brands.items).toHaveLength(1);

    const selectedBrand = keywordSearch.body.data.brands.items[0];
    expect(selectedBrand.brandName).toBe(seededBrandName);
    const selectedCard = page.locator('app-user-brandserch-card', {
      hasText: selectedBrand.brandName,
    }).first();
    await expect(selectedCard).toBeVisible();
    await demoPause(page, 4_000);

    const detailResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET'
        && url.pathname === `/api/brands/${selectedBrand.brandId}`;
    });
    const detailUrlPromise = page.waitForURL((url) =>
      url.pathname === '/user/brand-detail'
      && url.searchParams.get('brand') === String(selectedBrand.brandId));
    await selectedCard.click();
    await detailUrlPromise;
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
    await demoPause(page, 5_000);

    const detailResponse = await detailResponsePromise;
    const detailBody = (await detailResponse.json()) as ApiEnvelope<BrandDetail>;
    assertSuccessfulEnvelope(detailResponse, detailBody.statusCode);
    const detail = detailBody.data;
    expect(detail.brandId).toBe(selectedBrand.brandId);
    expect(detail.brandName).toBe(selectedBrand.brandName);
    expect(detail.category?.name).toBe(seededCategoryName);
    expect(detail.representativeProducts.some(
      (product) => product.productName === seededProductName,
    )).toBe(true);

    await expect(page.getByRole('heading', { name: detail.brandName, level: 1 })).toBeVisible();
    if (detail.brandSummary) await expect(page.getByText(detail.brandSummary, { exact: true })).toBeVisible();
    if (detail.brandDescription) {
      await expect(page.getByText(detail.brandDescription, { exact: true })).toBeVisible();
    }
    if (detail.category?.name) {
      await expect(page.getByText(detail.category.name, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(`參與過 ${detail.participatedMarkets.length} 場市集`)).toBeVisible();

    for (const market of detail.participatedMarkets) {
      await expect(page.getByText(market.eventTitle, { exact: true })).toBeVisible();
    }
    for (const product of detail.representativeProducts) {
      await expect(page.getByText(product.productName, { exact: true })).toBeVisible();
      if (product.productPrice !== null) {
        await expect(page.getByText(`NT$ ${product.productPrice}`, { exact: true })).toBeVisible();
      }
      if (product.productShortDescription) {
        await expect(page.getByText(product.productShortDescription, { exact: true })).toBeVisible();
      }
      const productImage = page.getByRole('img', { name: product.productName, exact: true });
      await expect.poll(() => productImage.evaluate(
        (element: HTMLImageElement) => element.naturalWidth,
      )).toBeGreaterThan(0);
    }

    const heroImage = page.getByRole('img', { name: '品牌封面', exact: true });
    const logoImage = page.getByRole('img', { name: `${detail.brandName} Logo`, exact: true });
    for (const image of [heroImage, logoImage]) {
      await expect.poll(() => image.evaluate(
        (element: HTMLImageElement) => element.naturalWidth,
      )).toBeGreaterThan(0);
    }
    for (const link of [detail.links.instagramUrl, detail.links.facebookUrl, detail.links.websiteUrl]) {
      if (link) await expect(page.locator(`a[href="${link}"]`)).toBeVisible();
    }
    await demoPause(page, 6_000);
  });
});
