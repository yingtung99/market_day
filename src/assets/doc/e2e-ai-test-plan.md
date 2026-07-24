# Market Day E2E 測試共用指南

最後更新：2026-07-15

## 1. 文件用途

本文件提供全組共用的 Playwright 安裝方式、執行指令、測試分類與撰寫規範，不保存各功能的詳細討論紀錄。

測試計畫分開維護：

- [帳號 E2E 測試計畫](./auth-account-e2e-test-plan.md)：攤主、主辦方、管理員帳號功能。
- [活動主流程 E2E 測試計畫](./event-main-flow-e2e-test-plan.md)：跨角色的活動建立、審核、報名、付款與選位。
- [管理員後台 E2E 測試計畫](./admin-management-e2e-test-plan.md)：管理員專屬的補件、下架審核、使用者管理與操作紀錄。

## 2. 目前環境

| 項目 | 設定 |
| --- | --- |
| 前端 | Angular，`http://localhost:4200` |
| 後端 | Spring Boot，`http://localhost:8081` |
| 測試工具 | Playwright Test |
| 瀏覽器 | Chromium |
| 測試目錄 | `e2e/` |
| 設定檔 | `playwright.config.ts` |
| 本機測試資料 | `.env.e2e.local` |

目前已支援：

- Headless、Headed 與 UI Mode。
- HTML Report、Trace、失敗截圖與失敗影片。
- Chromium 最大化、停用翻譯提示及共用視覺滑鼠指標。
- 一個 worker 依序執行，避免共用測試資料互相影響。
- Husky pre-push，自動執行 `@smoke` 測試。

## 3. 安裝方式

拉取專案後執行：

```powershell
npm install
npx playwright install chromium
```

一般情況不需要刪除 `node_modules`。依賴異常時才使用：

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
npx playwright install chromium
```

## 4. 本機環境變數

在前端根目錄建立 `.env.e2e.local`：

```env
E2E_VENDOR_EMAIL=攤主測試信箱
E2E_VENDOR_PASSWORD=攤主測試密碼
E2E_ORGANIZER_EMAIL=主辦方測試信箱
E2E_ORGANIZER_PASSWORD=主辦方測試密碼
E2E_ADMIN_EMAIL=管理員測試信箱
E2E_ADMIN_PASSWORD=管理員測試密碼
PW_SLOW_MO=1500
PW_UI_SLOW_MO=300
E2E_TARGET_ORGANIZER_EMAIL=目標主辦方測試信箱
E2E_TARGET_ORGANIZER_PASSWORD=目標主辦方測試密碼
E2E_TARGET_VENDOR_EMAIL=目標攤主測試信箱
E2E_TARGET_VENDOR_PASSWORD=目標攤主測試密碼
```

規則：

- 必須使用專用測試帳號，不得使用正式或個人帳號。
- `E2E_TARGET_ORGANIZER_*`／`E2E_TARGET_VENDOR_*` 是管理員後台測試專用的停用/恢復帳號目標，不可與 `E2E_ORGANIZER_EMAIL`／`E2E_VENDOR_EMAIL` 共用同一個帳號。
- `.env.e2e.local` 不可提交 Git。
- 沒有帳密的角色登入與登出案例會標示為 skipped。

## 5. 執行指令

目前可以使用：

```powershell
# 執行所有現有 E2E
npm run e2e

# 執行快速 Smoke；git push 前也會自動執行
npm run e2e:smoke

# 顯示瀏覽器執行
npm run e2e:headed

# 開啟 Playwright UI
npm run e2e:ui

# 查看 HTML Report
npm run e2e:report
```

`e2e:smoke` 會完整執行 22 個帳號案例，分為兩個階段：

1. 先用 3 個 workers 平行執行 20 個不修改密碼的 Smoke。
2. 再用 1 個 worker 執行標記 `@mutating` 的 2 個 AUTH-07 修改密碼案例，避免共用測試帳號互相影響。

pre-push 使用相同流程，兩個階段都通過後才會允許 push。

執行單一測試檔：

```powershell
npm run e2e:headed -- auth-login.spec.ts
```

以下名稱保留給未來使用，目前尚未加入 `package.json`：

```powershell
npm run e2e:full
npm run e2e:destructive
```

## 6. Smoke、Full、Destructive 規則

| 分類 | 使用情況 | 執行時機 |
| --- | --- | --- |
| `@smoke` | 快速、可重跑、不需要人工輸入、不破壞資料 | 每次 push 前 |
| `@full` | 較長的完整正常流程，可能需要建立及清理測試資料 | 合併重要功能或發布前 |
| `@destructive` | 註銷、刪除、退款等不可逆或高影響操作 | 使用專用資料手動執行 |

選擇方式：

```text
操作是否不可逆？
├─ 是 → @destructive
└─ 否
   ├─ 能快速、安全、重複執行 → @smoke
   └─ 是跨角色或較長的完整流程 → @full
```

帳號功能原則上只做最小 `@smoke`；註銷帳號即使只有一個案例，也必須使用 `@destructive`。

## 7. Real API 與 UI Stub

測試分類和 API 驗證範圍是兩件事：

| 方式 | 可以證明什麼 |
| --- | --- |
| Real API | 前端、後端、權限與資料格式實際整合成功 |
| UI Stub | 前端操作、導頁與訊息正常，不代表真實後端或外部服務成功 |

Email、Google OAuth 或不可安全改動的帳號狀態，可以先用 Playwright `page.route()` 或 Google SDK Stub 撰寫 UI Smoke，但測試計畫必須標示為「UI Smoke」，不可寫成真實 API 已完成。

## 8. 測試撰寫規範

- 測試檔放在 `e2e/`，檔名使用 `{role}-{feature}.spec.ts`。
- 從 `./fixtures` 匯入 `test` 與 `expect`，共用視覺滑鼠功能。
- 測試名稱使用中文並加入 `@smoke`、`@full` 或 `@destructive`。
- 優先使用 `getByRole()`、`getByLabel()`、`getByPlaceholder()`。
- 不使用固定秒數等待，應等待元素、網址或 API response。
- 後端部分業務失敗可能仍回傳 HTTP 200，因此必須檢查 JSON `statusCode`。
- 真實寫入測試必須使用專用資料，並在 `finally` 或 teardown 還原。
- 每個測試須可獨立執行，不依賴前一個測試成功。

範例：

```ts
import { expect, test } from './fixtures';

test('@smoke 功能名稱', async ({ page }) => {
  await page.goto('/target-page');

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/example') &&
      response.request().method() === 'POST',
  );

  await page.getByRole('button', { name: '送出' }).click();
  const response = await responsePromise;
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.statusCode).toBeGreaterThanOrEqual(200);
  expect(body.statusCode).toBeLessThan(300);
});
```

## 9. Git push 前自動測試

`npm install` 會透過 `prepare` 啟用 Husky。執行：

```powershell
git push
```

會先執行 `npm run e2e:smoke`：

- 全部通過才會繼續 push。
- 任一測試失敗、後端未啟動或缺少必要帳密時停止 push。
- 失敗仍會產生 HTML Report，但不會自動開啟報告伺服器。

本機 Hook 可被 `git push --no-verify` 略過。需要團隊強制檢查時，仍須增加 CI 與分支保護。

## 10. 安全與 Git 管理

以下內容不可提交：

```gitignore
.env.e2e.local
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
```

目前 `.env.e2e.local` 與舊的 `playwright-report/index.html` 仍被 Git 追蹤，應另行執行：

```powershell
git rm --cached .env.e2e.local
git rm --cached playwright-report/index.html
```

若帳密曾進入 Git、Report 或 Trace，必須更換測試帳號密碼。

## 11. 新增測試流程

1. 確認測試屬於 Smoke、Full 或 Destructive。
2. 確認使用 Real API 或 UI Stub。
3. 建立或更新 `e2e/*.spec.ts`。
4. 先執行單一測試檔。
5. 執行 `npm run e2e:smoke`。
6. 更新對應測試計畫的狀態表。
7. 執行 `git push`。

## 12. 目前 Smoke 現況

目前共有 22 個帳號 Smoke：20 個已分別驗證通過，AUTH-07 修改密碼的 2 個 Real API Smoke 待後端與資料庫可用後實跑。最近一次全部既有測試的完整執行結果仍為 `14 passed`：

- 攤主、主辦方、管理員未登入都不能直接進入各自後台。
- 攤主、主辦方填寫註冊資料後進入 Email 驗證頁（UI Stub）。
- 攤主、主辦方送出忘記密碼 Email 後進入重設驗證頁（UI Stub）。
- 主辦方正確帳密登入。
- 主辦方錯誤密碼不能登入。
- 主辦方登出並清除 Session。
- 攤主與管理員的正確帳密登入及登出。
- 攤主、主辦方的 Google 註冊、登入與綁定（6 個 UI Smoke，已通過）。
- 攤主、主辦方登入後修改密碼並自動還原（2 個 Real API Smoke，已實作待實跑）。
