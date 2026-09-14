# SALON POKE BY VIVA — 預約平台

單一香港店舖的員工排班、預約、客戶套票及營運後台。`appointments` 是唯一預約真相來源；建立、改期、取消及套票扣減由 PostgreSQL 指令在同一交易中處理。

正式開站請以 [2026-09-14 launch checklist](docs/launch-checklist-2026-09-14.md) 和 [營運手冊](docs/booking-platform-operations.md) 為準。它們保留 preview／production 的空白證據欄，未填妥前不可視為正式發佈核准。

## 本機開始

需要 Node.js 20 或以上。

```powershell
npm install
npm run dev
npm run test:unit
npm run security:scan
npm run build
npm run test:production-csp
```

完整 browser acceptance suite 只可對隔離的 E2E 環境執行，做法見 [e2e/README.md](e2e/README.md)。它會拒絕 production、preview、未標記資料庫及缺少測試憑證的設定。

`test:production-csp` 另行啟動已建置的本機 loopback 網站，清空服務憑證，檢查 nonce、登入 hydration、無 JavaScript 的安全 POST 及靜態檔案快取。它只使用已安裝的 Chromium，阻擋瀏覽器外部請求，不會下載瀏覽器、建立帳戶或連接供應商；不取代有憑證的 E2E／託管環境驗證。

## 環境變數

只把值放在本機未追蹤的 `.env.local` 或託管平台的 secret store；不要把值貼入 Git、測試證據、截圖或 issue。名稱如下：

| 用途 | 必要名稱 |
| --- | --- |
| Supabase 公開連線 | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；舊專案可用 `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 伺服器 Supabase 權限 | `SUPABASE_SERVICE_ROLE_KEY`（只可在伺服器） |
| 正式網站 URL | `NEXT_PUBLIC_SITE_URL` |
| 提醒 cron 授權 | `CRON_SECRET` |
| 電郵通知（啟用時） | `RESEND_API_KEY`、`NOTIFY_EMAIL_FROM`、`NOTIFY_DRY_RUN` |
| WhatsApp 通知設定 | `NOTIFY_WHATSAPP_PROVIDER` |
| Stripe 自助購買（啟用時） | `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`、`STRIPE_CURRENCY` |
| 多實例 rate limit（選用） | `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` |

`CRON_SECRET` 透過 `Authorization: Bearer` 驗證；舊有 query-secret 相容路徑仍存在，但新 cron 設定應使用 Authorization header。電郵功能實際由 `app_settings` 的 `notify_email_enabled` 和 `notify_dry_run` 控制：`NOTIFY_DRY_RUN` 未設定時才跟隨已儲存的 `notify_dry_run`；`1` 強制 dry-run；`0` 強制關閉 dry-run（live）。`0` 在電郵已啟用、Resend 設定及 SDK 都可用時可以實際送出，必須小心使用。Live Resend 另需 `RESEND_API_KEY`、`NOTIFY_EMAIL_FROM` 及 `resend` SDK；Stripe 自助購買另需 Stripe 變數及 `stripe` SDK。這兩個 SDK 目前未安裝，所以如在 preview／production 啟用任何相應功能，必須先安裝並以隔離環境驗證，否則為 no-go。

## 內容與資料保護

下列內容若未由管理員在 `site_content` 提供有效值，前台會刻意隱藏，而不是顯示假資料：電話、WhatsApp、電郵、Instagram、地址及地址補充說明。開站前由內容負責人填入已批准資料並在 preview smoke 中驗證；不要自行填入示例資料。

客戶套票和帳戶資料必須以登入身分取得。訪客可自費預約，但不能以電話號碼查詢客戶或套票。公開確認頁和日曆下載需要擁有者登入或不可猜測的確認 token。

## Schema、後台與事故處理

所有 schema 變更只來自 `supabase/migrations/`，並必須按檔名排序套用。不要修改已套用的 migration；用新的加法 migration 修正問題。第一位管理員、員工服務映射、每週工時、休息／請假、backup、preflight、停收新預約及 rollback 步驟都在 [營運手冊](docs/booking-platform-operations.md)。

舊的 [2026-09-07 checklist](docs/launch-checklist-2026-09-07.md) 僅保留歷史背景，不能用作此預約平台的發佈證據。
