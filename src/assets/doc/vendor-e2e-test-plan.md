# Market Day 攤主專區與後台 E2E 測試計畫

最後更新：2026-07-24

## 1. 文件目的

本文件依攤主的實際操作順序，規劃從未登入瀏覽、身份驗證、品牌建立、市集報名、付款、選位、退款，到帳號註銷的完整 E2E 驗收流程。

Vendor 自動化測試依 Organizer 相同方式拆分於 `e2e/vendor/frontend/` 與 `e2e/vendor/backend/`。註冊、Email 驗證、登入、Google 登入／綁定、忘記密碼、修改密碼、登出與帳號註銷，沿用 [帳號 E2E 測試計畫](./auth-account-e2e-test-plan.md)；本文件只描述攤主旅程需要的 Auth 驗收結果，不新增或修改 `auth-*.spec.ts`。

跨角色審核、金流 Sandbox、排程與最終名單流程，另由 [活動主流程 E2E 測試計畫](./event-main-flow-e2e-test-plan.md) 與 `e2e/event-main-flow.spec.ts` 負責。

關聯文件的責任如下：

- [帳號 E2E 測試計畫](./auth-account-e2e-test-plan.md)：Auth 案例編號、完成狀態及 Email／Google／destructive 限制的依據。
- [E2E 測試共用指南](./e2e-ai-test-plan.md)：Smoke、Full、Destructive、Real API、UI Stub、環境變數及 cleanup 規範。
- [活動主流程 E2E 測試計畫](./event-main-flow-e2e-test-plan.md)：跨角色 Happy Path、真實 Sandbox 付款、手動選位、自動分配及品牌公開的完成依據。

## 2. 攤主完整流程

### 1. 訪客／未登入階段（攤主專區）

* **瀏覽專區首頁**
  * **行為：** 進入攤主專區首頁，查看報名流程說明與可報名市集入口。
  * **期待結果：** 正常顯示介紹與導引按鈕（登入、註冊、查看報名市集）。
* **搜尋與查看市集報名列表**
  * **行為：** 使用市集名稱、地區、活動日期或報名狀態進行篩選與搜尋。
  * **期待結果：** 清單精確過濾，並正確顯示各場次剩餘攤位數與報名狀態。
* **查看市集報名詳情與觸發登入引導**
  * **行為：** 進入特定市集的「市集報名詳細」頁面，查看活動簡介、費用與剩餘名額，並點擊「立即報名」。
  * **期待結果：** 系統偵測到未登入狀態，自動跳轉或引導至攤主登入畫面。

---

### 2. 身份驗證與帳號管理（Auth）

* **攤主註冊與 Email 驗證**
  * **行為：** 輸入負責人姓名、Email 及符合規範的密碼（至少 8 字元、含英數）進行註冊；收取並輸入 6 位數驗證碼。
  * **期待結果：** 驗證成功跳出提示視窗，並引導至登入頁；密碼經雜湊安全儲存。
* **Google 第三方快速註冊／登入**
  * **行為：** 點擊「Google 快速註冊／登入」。
  * **期待結果：** 成功授權後自動建立帳號或完成登入，並取得 JWT Token。
* **帳號登入與失敗處理**
  * **行為：** 輸入 Email 與密碼登入；測試輸入錯誤密碼。
  * **期待結果：** 成功時取得 JWT Token 並進入後台；失敗時保留原 Email 並於欄位下方提示錯誤訊息。
* **忘記密碼與重設密碼流程**
  * **行為：** 於「忘記密碼」頁輸入 Email 申請重設；點擊信件連結輸入新密碼；測試兩次新密碼輸入不一致。
  * **期待結果：** 不一致時提示錯誤且禁止送出；重設成功後跳出成功提示並引導重新登入。

> Auth 自動化沿用 `AUTH-01`～`AUTH-10`。目前 AUTH-01、04～06 為 UI Smoke，AUTH-03、08、09 已完成 Real API／Auth Guard 驗證；AUTH-02 受測試信箱阻擋，AUTH-07 依 Auth 計畫仍待 Real API 實跑，AUTH-10 仍待一次性帳號 destructive 實跑。密碼雜湊必須由後端整合測試驗證，不能因註冊 UI Stub 通過就標示完成；Playwright 需確認畫面、儲存空間、Trace 與 Report 不洩漏密碼。

---

### 3. 首次登入與攤位／品牌資料管理

* **首次登入引導**
  * **行為：** 第一次登入系統後嘗試存取其他功能。
  * **期待結果：** 強制引導至「首次登入引導頁面」與「攤商資料管理」，未完成前無法進行報名。
* **建立與編輯品牌基本資料**
  * **行為：** 填寫品牌基本資料、聯絡資訊、社群連結、大頭貼、封面照片（限 1 張）、品牌簡介與介紹。
  * **期待結果：** 未完成時點擊其他選單會觸發未完成處理；首次建立顯示「建立攤位」，建立後按鈕自動切換為「儲存變更」。
* **代表商品管理**
  * **行為：** 開啟「新增商品」跳窗，填寫商品名稱、簡介、介紹、價格並上傳圖片（建議比例 4:3）；可進行商品編輯。
  * **期待結果：** 後台可管理多個商品，但前台品牌詳細頁最多僅顯示 3 個代表商品。

---

### 4. 市集報名填寫與送出流程

* **重複報名防護機制（重複檢查）**
  * **行為：** 嘗試對已有有效報名紀錄（待審核、待付款、待選位、報名完成、退款申請中、退款處理中）的同一市集再次點擊報名或直接送出報名 API。
  * **期待結果：** UI 與 API 都阻擋報名，並提示已有有效報名紀錄；不建立第二筆有效報名，也不重複扣除活動名額。已取消、審核未通過或已退款，且活動尚未截止、資格符合時可重新報名。
* **填寫報名資料與費用試算**
  * **行為：** 登入狀態下點擊「立即報名」，選擇參加日期、攤位類型、租借設備，並填寫用電需求、車牌登記與備註。
  * **期待結果：** 系統依據選擇項目即時自動試算並更新報名總費用。
* **報名資料確認與送出**
  * **行為：** 進入「報名資料確認」頁面，核對參加場次、設備與費用明細後送出。
  * **期待結果：** 送出後進入「報名送出完成頁」，產生一筆狀態為 **待審核** 的報名紀錄，並顯示報名編號與申請時間。此完成頁不等於選位後的業務狀態 **報名完成**。

> 「退款申請中」亦屬尚未完成的流程，後端應避免同一攤主在同一市集建立第二筆有效報名；正式狀態清單需與後端契約保持一致。

---

### 5. 報名審核與狀態變更處理

* **報名紀錄列表與狀態查詢**
  * **行為：** 進入後台「我的報名紀錄」，依據不同審核與交易狀態進行篩選。
  * **期待結果：** 清單只顯示符合條件的報名，並正確呈現報名編號、申請時間、目前狀態及可執行操作。
* **審核階段與付款前取消（待審核／待付款）**
  * **主動取消**
    * **行為：** 攤主在「待審核」或「待付款」狀態點擊「取消報名」，並於確認視窗再次確認。
    * **期待結果：** 狀態變更為 **已取消**，取消及付款入口失效，系統立即且只釋放一次活動名額。
  * **審核未通過**
    * **行為：** 查看「審核未通過」頁面。
    * **期待結果：** 顯示主辦方填寫的未通過原因；若活動尚未截止且資格符合，可重新提出報名。
* **待付款階段與金流支付**
  * **線上支付**
    * **行為：** 報名通過審核後，狀態變更為 **待付款**；點擊進入「信用卡付款」頁面完成模擬或實體金流支付；自動化測試僅可使用 Sandbox。
    * **期待結果：** 付款頁顯示後端核定金額與付款期限，不以過期的前端試算覆蓋。
  * **支付結果**
    * **付款成功**
      * **期待結果：** 跳出成功彈窗，顯示交易編號與時間，關閉後狀態自動更新為 **待選位**。
    * **付款失敗**
      * **期待結果：** 跳出失敗彈窗與原因，關閉後仍保持 **待付款**，並可重新嘗試付款。
    * **付款逾期**
      * **期待結果：** 超過後端核定付款期限（例如審核通過後 3 天）自動轉為 **已取消（逾期未付款）**，付款入口失效，系統自動且只釋放一次名額；測試不得把範例天數寫死成唯一規則。

> Vendor Smoke 不輸入真實信用卡，也不驗證金流簽章、callback、webhook 或正式款項。活動主流程 FLOW-21～25 已完成 Real API 核准、費用核對、藍新 Sandbox 付款、回呼及重新整理驗證；付款失敗與逾期取消仍屬待補的分支案例。

---

### 6. 互動選位與攤位地圖瀏覽

* **互動式地圖選位**
  * **行為：** 於 **待選位** 狀態進入「攤位選擇」頁面，查看區域、尺寸與可選攤位，點擊目標攤位。
  * **期待結果：** 跳出確認彈窗，顯示攤位編號與分區資訊，確認後完成選位，狀態轉為 **報名完成**。
* **選位競爭與衝突處理**
  * **行為：** 點擊的攤位同時被其他攤主搶先完成選位。
  * **期待結果：** 系統觸發併發衝突提示「攤位已被選擇」，自動更新地圖狀態，並引導攤主選擇其他可用攤位；後端不得建立重複 assignment。
* **未選位自動分配（邊界條件）**
  * **行為：** 已完成付款（待選位）但未於選位截止前手動選位。
  * **期待結果：** 最終名單確認階段由系統自動分配剩餘攤位，狀態更新為 **報名完成**，同一日期不得重複分配攤位；未付款報名不得取得攤位，重複執行排程也不得重複分配或建立通知。
* **完成選位與地圖參照**
  * **行為：** 完成選位後進入 **報名完成** 狀態，開啟「攤位地圖瀏覽」查看已選位置與周邊配置。
  * **期待結果：** 地圖正確標示自己的攤位、分區與周邊配置，作為進場擺攤參考；完成選位後不可任意更換攤位。

> FLOW-26～28 已完成 Real API 手動選位、重新整理持久化與完整報名結果驗證。FLOW-33 與後端 `AutomaticStallAssignmentFlowIT` 已驗證未選位自動分配；搶位衝突的真實雙帳號併發與完成選位後非法更換 API，仍屬 Vendor Full 分支案例。

---

### 7. 退款、取消與保證金處理

* **待選位階段申請退款**
  * **行為：** 於 **待選位** 狀態且在報名截止日前點擊「申請退款」，於彈窗確認退款金額（僅退報名費，保證金不退）與方式後送出。
  * **期待結果：** 狀態更新為 **退款申請中**；主辦方審核通過後轉為 **退款處理中**；金流完成退回後轉為 **已退款**，顯示退款完成時間與紀錄，並釋放活動名額。
* **退款限制（邊界條件）**
  * **行為：** 檢查「已完成選位」或「已過報名截止日」的報名紀錄。
  * **期待結果：** 系統隱藏或禁用退款按鈕，直接呼叫退款 API 也必須被拒絕，原狀態、款項與名額不得改變。
* **保證金現場退還與紀錄**
  * **行為：** 活動結束並完成撤場後，於現場向主辦方辦理保證金退還，並於後台查看紀錄。
  * **期待結果：** 後台報名詳細頁正確顯示保證金退還狀態（例如：已退還／不予退還）、時間、方式或對應說明。

> 退款申請中與退款處理中仍屬有效報名；只有退款完成轉為已退款後才釋放名額，且只能釋放一次。退款與退出活動尚列於活動主流程的後續分支。現場出席、撤場及違規事實由人工或主辦方驗收；Playwright 只驗證主辦方完成記錄後的攤主端顯示，不驗證現場事實或正式退款入帳。

---

### 8. 個人帳號設定與帳號註銷

* **修改密碼與 Google 綁定**
  * **行為：** 於「帳號設定」修改密碼或進行 Google 帳號綁定。
  * **期待結果：** 修改密碼需驗證目前密碼，成功後可使用新密碼登入；Google 綁定成功後，畫面與 Session 使用者資料同步更新。
* **登出與自動登出機制**
  * **行為：** 手動點擊登出；或是 Token 過期／系統閒置逾時。
  * **期待結果：** 清除本地 Token 與登入狀態，重定向回攤主登入頁；再次直接進入後台時會被 Auth Guard 阻擋。
* **帳號註銷保護與執行**
  * **情境 A（不可註銷）**
    * **行為：** 攤主仍有進行中的報名（待審核、待付款、待選位、報名完成且活動未結束、退款申請中、退款處理中）時點擊註銷。
    * **期待結果：** 系統顯示「暫不可註銷」提示彈窗並列出未完成事項；後端拒絕註銷，帳號與 Session 保持有效。
  * **情境 B（順利註銷）**
    * **行為：** 符合註銷條件時點擊註銷，於二次確認彈窗確認。
    * **期待結果：** 帳號停用、資料不可復原，系統顯示「註銷成功」，清除 Session 並自動導向登入頁；原帳密不可再次登入。

> AUTH-06 Google 綁定目前為 UI Smoke；AUTH-07 依 Auth 計畫仍待 Real API 實跑；AUTH-08 Real API 登出與 AUTH-09 Auth Guard 已完成。Token 過期／閒置逾時需先確認前端 timeout 或 refresh 契約。真實註銷 AUTH-10 屬 `@destructive`，目前仍待一次性帳號實跑，不得使用 Smoke 帳號或放入 pre-push。

## 3. 自動化案例與測試檔對照

| 流程階段 | 案例編號 | 測試檔 | 目前方式 |
| --- | --- | --- | --- |
| 訪客／未登入 | VENDOR-PORTAL-01～06 | `e2e/vendor/frontend/vendor-public-zone.spec.ts` | UI Smoke／部分 `test.fixme` |
| 市集搜尋與詳情 | VENDOR-MARKET-01～08 | `e2e/vendor/frontend/vendor-market-discovery.spec.ts` | UI Smoke／部分契約受阻擋 |
| 公開專區 RWD | VENDOR-RWD-01～02 | `e2e/vendor/frontend/vendor-responsive.spec.ts` | UI Smoke；手機導覽及桌面／平板／手機溢位 |
| 身份驗證 | AUTH-01～10 | `e2e/auth-*.spec.ts` | 沿用 Auth 計畫；UI Smoke、Real API、受阻擋與 destructive 狀態並存 |
| 首次登入與品牌 | VENDOR-PROFILE-01～06 | `e2e/vendor/backend/vendor-profile.spec.ts` | UI Smoke＋Real API 待補 |
| 報名與重複防護 | VENDOR-APP-01～05 | `e2e/vendor/backend/vendor-application.spec.ts` | UI Smoke＋Real API 待補 |
| 取消與逾期 | VENDOR-CANCEL-01～04 | `e2e/vendor/backend/vendor-application-cancel.spec.ts` | UI Smoke＋排程 fixture 待補 |
| 付款狀態 | VENDOR-PAY-01～03 | `e2e/vendor/backend/vendor-payment.spec.ts` | 只讀 UI Smoke；成功 Sandbox 已由主流程完成，失敗／逾期分支待補 |
| 互動選位 | VENDOR-BOOTH-01～07 | `e2e/vendor/backend/vendor-booth-selection.spec.ts` | UI Smoke；主流程手動／自動選位已完成，真實併發分支待補 |
| 退款 | VENDOR-REFUND-01～06 | `e2e/vendor/backend/vendor-refund.spec.ts` | UI Smoke＋Real API／時間 fixture 待補 |
| 公開與保證金 | VENDOR-PUBLIC-01～02、VENDOR-DEPOSIT-01～02 | `e2e/vendor/backend/vendor-publication-deposit.spec.ts` | fixture／destructive 待補 |
| 通知與註銷限制 | VENDOR-NOTIFY-01～04、VENDOR-ACCOUNT-01～03 | `e2e/vendor/backend/vendor-notification-account.spec.ts` | UI Smoke＋Real API／destructive 待補 |

共用 Vendor Session、Stub、fixture 與 assertion 位於 `e2e/vendor/vendor-flow-helpers.ts`。

## 4. 關鍵狀態與後端規則

### 4.1 重複報名

以下進行中狀態必須阻擋同一攤主對同一市集再次報名：

1. 待審核。
2. 待付款。
3. 待選位。
4. 報名完成。
5. 退款申請中。
6. 退款處理中。

已取消、審核未通過及已退款可在活動尚未截止且資格符合時重新報名。阻擋重複報名時，不得建立第二筆資料或再次扣除名額。

### 4.2 取消與名額

- 待審核與待付款可以取消。
- 待選位、報名完成及退款流程不得取消。
- 取消或付款逾期後，名額只能釋放一次。
- UI 沒有取消按鈕時，直接呼叫 API 也必須被後端拒絕。

### 4.3 退款

- 只允許待選位、尚未完成選位且未超過報名截止的紀錄申請。
- 退款金額以後端核定報名費為準，不包含保證金。
- 退款申請中與退款處理中仍屬進行中流程。
- 已退款後才釋放名額，且只能釋放一次。

### 4.4 註銷

- 待審核、待付款、待選位、退款流程或未結束活動都必須阻擋註銷。
- 後端拒絕時不得清除 Token 或 Session。
- 真實成功註銷必須驗證原帳密無法再次登入。

## 5. 測試分層與標記

| 類型 | 用途 | 可證明範圍 |
| --- | --- | --- |
| `@smoke`／UI Stub | 快速驗證表單、按鈕、導頁及 payload | 前端互動，不代表 Real API 完成 |
| `@full`／Real API | 驗證狀態、權限、名額及持久化 | 前後端整合與資料規則 |
| Sandbox Flow | 測試金流環境的付款流程 | Sandbox 交易，不代表正式環境 |
| `@destructive` | 註銷、真實選位或不可安全還原資料 | 只以一次性資料手動執行 |

執行規則：

- 每個案例可獨立執行，不依賴前一案例成功。
- 寫入資料的案例加上 `@mutating`，並在 `finally` 或 teardown 還原。
- 業務 API 即使回傳 HTTP 200，也必須檢查 JSON `statusCode`。
- UI 隱藏或禁用按鈕不能取代 API 權限與狀態驗證。
- `@destructive` 不得加入 pre-push。

## 6. 目前實作與實跑紀錄

最後紀錄：2026-07-24

```powershell
npm.cmd run e2e:vendor:smoke
```

本次結果：完成 frontend／backend 拆分並新增 RWD 後，Vendor Smoke 共 `26 passed`、`0 failed`，headed 單一 worker 搭配 HTML Report 耗時約 2.5 分鐘。Playwright 可收集 46 個 Vendor 案例；另外 20 個未標記 `@smoke` 的 `test.skip`／`test.fixme` 仍需 Real API、後端 seed、測試時鐘、Sandbox 或一次性 destructive 資料，不列入本次 Smoke 通過數。

關聯計畫的已完成結果不併入上述 46 個 Vendor 案例計數：

- Auth：AUTH-03、08、09 已完成 Real API／Auth Guard；其餘狀態以 Auth 計畫為準。
- 活動主流程：2026-07-22 已完成 FLOW-01～34，同一次 headed Chromium 流程涵蓋 Real API 報名、藍新 Sandbox 付款與回呼、手動選位、排程自動分配及品牌公開。
- 分支案例：付款失敗／逾期、搶位真實併發、退款／退出活動、保證金與註銷 destructive，仍不可因 Happy Path 通過而標示完成。

已完成的主要 UI Smoke：

- 公開攤主專區首頁、CTA、關於我們及登入狀態導覽。
- 手機導覽開關、背景、Escape、路由收合，以及公開頁桌面／平板／手機水平溢位。
- 未登入市集瀏覽、搜尋 query、OPEN／FULL 切換、空狀態及立即報名分流。
- 首次登入限制、品牌必填與封面限制。
- 報名欄位驗證、確認頁及 request payload。
- 取消操作權限與待付款頁資料。
- 地圖可選／占用狀態及搶位衝突提示。
- 退款入口限制、通知中心及註銷失敗 UI。

主要待補／`test.fixme`：

1. 首頁可報名市集查詢需明確限制 OPEN。
2. 市集卡片需使用後端報名截止日並顯示各場次剩餘攤位。
3. 詳情頁需完整顯示場地須知。
4. 「立即報名」的 `aria-disabled` 與登入引導 click 行為需一致。
5. 報名表單尚缺攤位類型欄位及 request 契約。
6. 後台需支援管理多筆商品，前台才限制最多顯示 3 筆。
7. 報名完成詳情不得顯示退款入口。
8. Vendor Standalone 的付款逾期、自動分配、退款完成與保證金結果仍需要可重設 fixture 或測試時鐘；其中自動分配已由活動主流程與後端整合測試驗證。

## 7. 測試資料與環境

### 7.1 建議 fixture

| fixture | 用途 | 重設要求 |
| --- | --- | --- |
| `vendor-public-anonymous` | 未登入首頁、市集列表與登入分流 | 不設 Token，使用唯讀 Stub |
| `vendor-profile-empty` | 首次登入與資料鎖定 | 每次還原為資料未完成 |
| `vendor-profile-ready` | 一般報名流程 | 固定品牌、類別與商品 |
| `vendor-duplicate-status` | 重複報名狀態 | 清除報名並還原名額 |
| `vendor-payment` | 待付款、成功、失敗與逾期 | 不發起正式交易 |
| `vendor-booth-a`／`vendor-booth-b` | 搶位競態 | 清除選位與 assignment |
| `vendor-refund` | 退款資格與生命週期 | 不發起正式退款 |
| `vendor-deactivate-blocked` | 註銷限制 | 清除阻擋資料但保留帳號 |
| `event-deadline` | 付款、選位與退款期限 | 可控制測試時鐘 |
| `event-finalized` | 自動分配、活動結束與保證金 | 可重設最終狀態 |

UI Smoke 的非敏感固定資料集中於 `e2e/vendor/vendor-test-data.ts`，目前包含：

- 攤主、聯絡人、品牌與 4 筆代表商品資料。
- 市集日期、剩餘名額、報名費、保證金、設備費與用電費。
- 待審核、待付款、待選位、報名完成、退款申請中、退款處理中、已取消、審核未通過及已退款等狀態。
- 付款成功／失敗／逾期、可選／已占用／自動分配攤位、退款、保證金及通知資料。

`e2e/vendor/vendor-flow-helpers.ts` 負責把上述資料轉成前端 API 契約。這些 Stub 只供可重跑的 UI 與 request-contract 測試；Real API 案例仍須由後端 seed 建立對應狀態並提供 cleanup，不得把 Stub 通過視為資料庫流程已通過。

### 7.2 環境變數

公開 UI Smoke 不需要真實帳密。Real API 與 mutating 案例使用不提交 Git 的專用資料：

```env
E2E_VENDOR_EMAIL=
E2E_VENDOR_PASSWORD=
E2E_VENDOR_PROFILE_EMPTY_EMAIL=
E2E_VENDOR_PROFILE_EMPTY_PASSWORD=
E2E_VENDOR_CONCURRENT_EMAIL=
E2E_VENDOR_CONCURRENT_PASSWORD=
E2E_VENDOR_EVENT_ID=
E2E_VENDOR_EVENT_TITLE=
```

Destructive 案例必須使用獨立的一次性資料：

```env
E2E_DESTRUCTIVE_VENDOR_EMAIL=
E2E_DESTRUCTIVE_VENDOR_PASSWORD=
E2E_DESTRUCTIVE_APPLICATION_NO=
```

真實值只可放在 `.env.e2e.local`，不得寫入 Markdown、測試檔、Trace 或 HTML Report。

## 8. 執行方式

```powershell
# 列出 Vendor 案例
npm.cmd run e2e:vendor:list

# 公開攤主專區與市集探索
npm.cmd run e2e:vendor:portal

# Vendor 公開專區與一般後台案例
npm.cmd run e2e:vendor

# 只執行 Vendor 後台案例
npm.cmd run e2e:vendor:backend

# 執行 Vendor Smoke
npm.cmd run e2e:vendor:smoke

# 個別執行 Profile Guard、退款或保證金結果
npm.cmd run e2e:vendor:profile-guard
npm.cmd run e2e:vendor:refund
npm.cmd run e2e:vendor:deposit-refund
```

Vendor 與 Organizer 完整測試均固定使用 headed 模式及單一 worker，避免共用帳號、報名、付款、退款與選位狀態互相衝突。PowerShell 若可正常執行 `npm`，可省略 `.cmd`；若出現未經數位簽署或 ExecutionPolicy 錯誤，使用 `npm.cmd`。

## 9. 完成門檻

### 第一階段：UI Smoke

- 公開頁、表單、按鈕、導頁、提示及 request 契約可安全重跑。
- 不建立永久資料、不操作真實付款、不註銷帳號。
- 修正目前 `test.fixme` 的 UI、契約與可存取性缺口。

### 第二階段：Real API Full

- 建立指定狀態的 seed、測試時鐘與可靠 cleanup。
- 完成品牌持久化、重複報名、取消、名額、退款及註銷限制。
- 雙攤主搶位不得建立重複 assignment。
- 每個案例成功或失敗後都能還原資料。

### 第三階段：Sandbox／Destructive

- 使用 Sandbox 驗證明確的付款流程。
- 使用一次性帳號驗證實際註銷。
- 使用一次性活動資料驗證完成選位、自動分配、活動結束與保證金結果。
- 由負責人明確執行，不加入 pre-push。

## 10. 文件更新規則

新增或修改 Vendor E2E 後，需同步更新：

- 測試檔與案例名稱。
- UI Smoke、Real API、Sandbox 或 destructive 分類。
- 案例狀態：待實作、受阻擋、已完成、`test.fixme` 或 `test.skip`。
- fixture、初始狀態及 cleanup 結果。
- 最近一次實跑日期、通過數、skip 數及失敗原因。
- 前端、後端與文件之間的狀態名稱或欄位差異。

不得因 UI Stub 通過就標示 Real API 已完成，也不得只靠 UI 隱藏按鈕宣稱後端權限與狀態規則已通過。
