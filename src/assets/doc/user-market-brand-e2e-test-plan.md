# Market Day 一般使用者市集及品牌探索 E2E 測試計畫

最後更新：2026-07-27

## 1. 文件目的

本文件管理一般使用者公開頁面的 Playwright Real API E2E 測試，涵蓋：

- `POST /api/markets/search`：目前活動、歷史活動及各搜尋欄位。
- `GET /api/markets/{id}`：市集詳情、審計新村地圖、攤位與品牌資訊。
- `GET /api/brands/search`：品牌列表、品牌名稱及品牌類型搜尋。
- `GET /api/brands/{id}`：品牌公開詳情。

測試不需要登入，不使用 `page.route()` Stub，也不得依賴搜尋結果第一筆或固定資料庫 ID。

## 2. 測試檔與資料來源

| 類型 | 路徑 |
| --- | --- |
| 市集 Playwright | `e2e/user/user-market.spec.ts` |
| 品牌 Playwright | `e2e/user/user-brand.spec.ts` |
| 共用 SQL seed | `F:\MarketDay\sql\user-market-brand-e2e-test-data.sql` |
| 帳號＋資料一鍵執行器 | `F:\MarketDay\sql\run-e2e-seed.ps1` |
| 日期刷新與精準值檢查 | `e2e/sql/refresh-user-market-brand-e2e-dates.sql` |

SQL seed 是本文件唯一指定的公開市集與品牌測試資料來源。`run-e2e-seed.ps1` 會讀取前端根目錄的 `.env.e2e.local`，以後端相同的 BCrypt 實作產生雜湊，建立或更新攤主、主辦方及管理員帳號，再執行公開市集／品牌 seed；明文密碼不會寫入 SQL。

每次執行公開市集／品牌 E2E 前，先載入共用 SQL seed，再執行日期刷新腳本。刷新腳本會將目前活動更新為今天至明天、歷史活動更新為 35 至 34 天前，並精準驗證 `台中市`、`西區`、`審計新村368新創聚落`、`民生路368巷` 及兩筆指定品牌；缺少任一 canonical seed 時會直接失敗，不會以其他資料代替。

### 2.1 環境

- 前端：`http://localhost:4200`
- 後端：`http://localhost:8081`
- 資料庫：本機開發用 `MarketDayDB`
- 瀏覽器：Playwright Chromium
- 執行模式：Real API、未登入、單一 worker

### 2.2 Seed 保證

`user-market-brand-e2e-test-data.sql` 使用 transaction、`XACT_ABORT ON` 與 `TRY/CATCH`；失敗時 rollback，並可重複執行。它以 Email、slug、活動名稱、申請編號及攤位編號校正既有資料，不修改 schema。

固定自然鍵與預期資料：

| 資料 | 固定值 |
| --- | --- |
| 主辦方 Email | `island.days.organizer@marketday.local` |
| 餐飲品牌 Email | `sunlight.kitchen@marketday.local` |
| 手作品牌 Email | `forest.craft@marketday.local` |
| 分類 | `餐飲美食`、`文創手作` |
| 目前活動 | `島嶼日和生活市集` |
| 歷史活動 | `春日野餐市集` |
| 品牌 | `日光小廚房`、`森日手作所` |
| 地點 | `審計新村368新創聚落` |
| 地址 | `台中市 西區 民生路368巷` |
| 主要配置攤位 | `A09`、`B02` |

日期依 seed 執行日相對產生：目前活動為今天至明天，歷史活動為 35 天前至 34 天前。兩者皆為 `PUBLISHED` 且公開時間已到。

主活動包含 A01–A28、B01–B13、C01–C09，共 50 個唯一一般攤位；「服務處」是設施，不計入攤位。50 個攤位都有品牌配置，同一日期不得重複配置品牌。

此外 seed 建立 10 筆額外目前活動與 3 筆額外歷史活動；每場都使用審計新村地址、50 個攤位及已配置品牌，且活動日期彼此不重疊。公開文字不得包含 `E2E`、`TEST`、`Payment`、`Refund`、「測試」或「退款」。

## 3. API 契約

所有 API 使用共用 envelope：

```ts
interface ApiEnvelope<T> {
  statusCode: number;
  message: string;
  messageDetails: string | null;
  data: T;
}
```

分頁資料必須包含 `items`、`page`、`pageSize`、`totalItems`、`totalPages`、`hasPrevious`、`hasNext`。

### 3.1 `POST /api/markets/search`

搜尋參數位於 query string，body 為 `{}`：

| 參數 | 用途 |
| --- | --- |
| `eventType` | `目前活動` 或 `歷史活動` |
| `keyword` | 市集名稱或關鍵字 |
| `city` | 縣市 |
| `eventStatus` | 活動狀態 |
| `startDate`、`endDate` | `YYYY-MM-DD` |
| `categoryNames` | 單一分類名稱 |
| `page`、`pageSize` | 前端固定 `1`、`6` |

### 3.2 `GET /api/markets/{id}`

`id` 必須取自搜尋回應。基本詳情階段不得附帶 `date` 或 `stallNo`；選取 A09 時才允許依前端流程發出攤位詳情 request。

主要驗證欄位：名稱、摘要、介紹、日期、時間、地點、地址、分類、主辦方、交通方式、封面、`brandsPublic` 及選取攤位品牌。

### 3.3 `GET /api/brands/search`

品牌探索頁使用：

| 參數 | 用途 |
| --- | --- |
| `keyword` | 品牌名稱或內容關鍵字 |
| `categoryName` | 品牌類型 |
| `page`、`pageSize` | 前端固定 `1`、`6` |

目前 UI 不顯示參與市集篩選，因此測試不得要求或送出 `marketName`。搜尋資料位於 `data.brands`，且 `data.totalCount` 必須等於 `data.brands.totalItems`。

### 3.4 `GET /api/brands/{id}`

`id` 必須取自名稱搜尋回應。驗證品牌名稱、摘要、介紹、類型、代表商品、參與市集、社群連結、封面、Logo 與商品圖片。

## 4. 測試案例與狀態

| 編號 | 案例 | 分類 | 狀態 |
| --- | --- | --- | --- |
| USER-MARKET-01 | 初始公開市集列表 | Smoke | 已完成 |
| USER-MARKET-02 | 目前市集詳情與完整地圖 | Smoke | 已完成 |
| USER-MARKET-03 | 市集各欄位單獨搜尋 | Regression | 已完成 |
| USER-MARKET-04 | 歷史活動列表 | Regression | 已完成 |
| USER-BRAND-01 | 初始品牌列表 | Smoke | 已完成 |
| USER-BRAND-02 | 品牌名稱與類型單獨搜尋 | Regression | 已完成 |
| USER-BRAND-03 | 品牌詳情 | Smoke | 已完成 |

`USER-MARKET-04` 已同步使用 seed 的歷史活動名稱「春日野餐市集」。

## 5. 市集 E2E 旅程

### 5.1 USER-MARKET-01／03：列表與單欄位搜尋

**Given**

- 開啟 `/user/activity-list` 前先等待 `POST /api/markets/search`。
- 初始頁面至少可由 seed 取得多筆目前活動。

**When**

1. 驗證初始列表與圖片。
2. 第一個欄位直接搜尋，不先按「清除條件」。
3. 後續在同一頁清除前一條件，再分別操作縣市、狀態、日期、分類與名稱。
4. 最後使用「島嶼日和生活市集」取得唯一結果。

**Then**

- 每次 API 只包含目前單一條件、`eventType=目前活動`、`page=1`、`pageSize=6`。
- 不重新載入首頁，不殘留上一個搜尋條件。
- 搜尋前後總筆數與畫面卡片有明確差異。
- 名稱搜尋唯一取得「島嶼日和生活市集」，狀態顯示「進行中」。
- 卡片標題、日期、地點、分類及圖片與 API 一致，圖片 `naturalWidth > 0`。
- 公開卡片不含測試、付款或退款字樣。

### 5.2 USER-MARKET-02：詳情、地圖與攤位品牌

**Given** 使用名稱搜尋回應取得目前活動 ID。

**When**

1. 點擊同一張活動卡片並等待 `/user/activity-detail?marketId={id}` 與 `GET /api/markets/{id}`。
2. 網址切換後立即驗證 `window.scrollY <= 1`，Demo 在頁面頂端停留至少 5 秒。
3. 驗證審計新村地點、地址與基本詳情。
4. 往下捲動至「攤位地圖」。
5. 驗證底圖道路「民生路」及「中興街」。
6. 驗證 A01–A28、B01–B13、C01–C09 的完整集合與唯一性。
7. 點擊 A09，等待相同活動 ID、日期及 `stallNo=A09` 的詳情，驗證「日光小廚房」與品牌圖片。
8. 驗證品牌一覽與 A／B／C 分區。

**Then**

- 詳情 ID 與搜尋 ID 相同。
- `locationName=審計新村368新創聚落`、`city=台中市`、`district=西區`、`address=民生路368巷`。
- 地圖恰有 50 個一般攤位，「服務處」不得計入。
- A09、B02 的配置狀態正確覆蓋；A09 品牌與圖片可見。
- 不以固定資料庫 event ID 尋找活動。

### 5.3 USER-MARKET-04：歷史活動

**When** 切換「歷史活動」並等待 `eventType=歷史活動` 的搜尋回應。

**Then** 回應與畫面包含「春日野餐市集」，日期早於今天，卡片圖片有效，文字不含測試相關內容。

## 6. 品牌探索 E2E 旅程

### 6.1 USER-BRAND-01／02：列表與單欄位搜尋

**Given** 開啟 `/user/brands` 前等待 `GET /api/brands/search`。

**When**

1. 驗證初始品牌列表。
2. 不先清除條件，直接選「餐飲美食」搜尋。
3. 同頁切回「全部類型」，輸入「日光小廚房」搜尋。

**Then**

- 類型 request 只包含 `categoryName=餐飲美食`、`page=1`、`pageSize=6`。
- 名稱 request 只包含 `keyword=日光小廚房`、`page=1`、`pageSize=6`。
- 兩次 request 均不得包含 `marketName` 或殘留前次條件。
- 類型結果全部為餐飲美食；名稱搜尋唯一取得日光小廚房。
- 卡片封面與 Logo `naturalWidth > 0`，公開文字自然且無測試字樣。

### 6.2 USER-BRAND-03：品牌詳情

**Given** 使用名稱搜尋回應取得日光小廚房的 `brandId`。

**When** 點擊同一品牌卡片，等待 `/user/brand-detail?brand={id}` 與 `GET /api/brands/{id}`；網址切換後立即驗證 `window.scrollY <= 1`。

**Then** 詳情 ID、名稱、摘要、介紹、餐飲美食分類、蜂蜜檸檬氣泡飲、價格、商品描述、參與市集、社群連結及所有圖片與 API 一致。

## 7. 預定 Smoke 範圍

| 編號 | 最小成功 Smoke | 完成限制 |
| --- | --- | --- |
| USER-MARKET-01 | 取得並顯示公開目前活動 | 使用 Real API 與自然資料 |
| USER-MARKET-02 | 進入同一活動詳情並驗證地圖 | 驗證審計新村、50 攤位及 A09 品牌 |
| USER-BRAND-01 | 取得並顯示公開品牌 | 至少兩筆品牌與有效圖片 |
| USER-BRAND-03 | 進入同一品牌詳情 | 不開啟外部社群網站 |

不納入 Smoke：空結果、API 失敗、無效 ID、分頁邊界、搜尋排列組合、日期切換、A09 以外的個別攤位及外部網站實際連線。

## 8. 執行方式

先在 PowerShell 執行一鍵 seed；它會從 `.env.e2e.local` 建立帳號並載入本機 `MarketDayDB`：

```powershell
cd F:\MarketDay\front\market_day\market_day
npm run e2e:seed
```

要驗證可重複執行，可連續執行兩次；第二次不應增加 canonical 資料量。

再執行 build 與測試：

```powershell
npm run build
npx playwright test e2e/user/user-market.spec.ts e2e/user/user-brand.spec.ts --workers=1
npm run e2e:user-market:demo
npm run e2e:user-brand:demo
```

Demo 使用 headed、單一 worker、每步慢速一秒及瀏覽器 75% 縮放。

## 9. 驗收與完成規則

- 指定 SQL seed 連續執行兩次均成功，固定自然鍵唯一，資料量不重複增加。
- Angular build 成功。
- 市集與品牌 Real API Playwright 全部通過。
- API method、pathname、query parameters、envelope 與前端畫面均有 assertion。
- 所有重要圖片驗證 `naturalWidth > 0`。
- 市集與品牌 ID 都取自搜尋回應，不寫死 ID。
- `USER-MARKET-04` 同步為「春日野餐市集」。
- 狀態只能依指定 seed 的最新 Real API 實跑結果更新，不得沿用舊 seed 的成功紀錄。
- 共用 seed 位於 `F:\MarketDay\sql\user-market-brand-e2e-test-data.sql`。

### 9.1 2026-07-27 實跑結果

- Angular production build：成功。
- Chromium Real API：市集與品牌共 `3 passed (1.5m)`。
- 市集 headed 75% Demo：`2 passed (2.8m)`。
- 品牌 headed 75% Demo：`1 passed (1.5m)`。
