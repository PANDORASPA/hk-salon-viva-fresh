# SALON POKE BY VIVA — 爆毛術脫髮護理

香港脫髮護理及髮型服務網站。提供公開預約、套票(package ticket)管理、客戶帳戶、管理後台、審計日誌、GDPR 工具、Stripe 付款、bilingual zh-HK / en UI。

> **品牌**：`SALON POKE BY VIVA` + `爆毛術脫髮護理`  
> **Repo**：`https://github.com/PANDORASPA/hk-salon-viva-fresh`  
> **部署**：Vercel auto-deploy on push to `master`

## 功能一覽

### 公開頁面
- 主頁 / 服務 / 預約 / 確認 / 套票 / 圖庫 / 關於 / 聯絡 / 位置
- 私隱政策 / 使用條款
- 雙語 (`zh-HK` / `en`),cookie 切換,`<html lang>` 自動跟住
- `sitemap.xml` + `robots.txt` + OG image + brand favicon

### 客戶帳戶
- 登入 / 註冊 / 忘記密碼 / 重設密碼
- `/account` 看自己嘅預約 + 套票
- `/account/profile` 改自己嘅名 / 電話 / 電郵
- 取消 / 改期預約(套票自動退還一次再重新扣減)
- 24 小時取消期限(可喺 `/admin/settings` 改)

### 管理後台 (`/admin`)
9 個 tabs,每個動作都會寫 `admin_audit_logs`:

| Tab | 功能 |
|---|---|
| 預約 | 確認 / 完成 / 取消 / no-show |
| 客戶 | 搜尋 / 編輯 / 派套票 / **GDPR 匯出** / **GDPR 硬刪除** |
| 套票 | CRUD 套票 templates |
| 服務定價 | CRUD 服務 |
| **設定** | 通知偏好(email / WhatsApp / console / dry-run)+ 預約規則(取消期限、提醒提前、buffer) |
| 營業時間 | 每週時間 + 特別休息日 |
| 圖庫 | 上傳 / 改 alt / 刪除(Supabase Storage) |
| 網站內容 | hero / contact / brand JSONB |
| 管理員 | 邀請 / 啟停 admin user |
| 審計日誌 | 過濾 + 查看 action history |

### 自動化
- **24 小時提醒 cron** — Vercel cron 每小時跑 `/api/cron/reminders`(跟住 `app_settings.reminder_hours_before`)
- **預約確認 / 取消 / 改期通知** — `lib/notifications/notify.js` console + Supabase audit log + email(Resend,dry-run fallback)
- **GDPR 匯出** — JSON download:customer + packages + appointments + notifications
- **GDPR 硬刪除** — CASCADE 刪除,留 `audit_logs` 保留合規紀錄

### 付款
- **Stripe 自助買單**(`/packages`)— mock mode 啱用 demo,set `STRIPE_SECRET_KEY` + webhook secret 就 live
- Webhook 自動發行 `customer_packages` row
- Idempotent via `user_tickets.stripe_event_id` UNIQUE

### 安全
- 內容安全政策(production 收緊 `'unsafe-inline'` script)
- Rate limiting on mutations(`lib/security/request-guards.js`)
- Supabase RLS 全部啟用
- 客戶 hard delete / GDPR export 全部 admin-only
- 每個 admin API 用 `adminContext()` 重新驗證 `admin_users.is_active = true`

## 技術架構

| 層 | 技術 |
|---|---|
| 前端 | **Next.js 16** (App Router) + React 18 |
| 後端 | Next.js Route Handlers (`/app/api/*`) |
| 資料庫 | **Supabase** (PostgreSQL 15) |
| 認證 | Supabase Auth (email + password) |
| 套票邏輯 | Postgres RPC (`redeem_customer_package` / `refund_customer_package`) + `lib/booking/package-usage.js` legacy fallback |
| 部署 | Vercel (auto-deploy on push) |
| 測試 | `node --test` (`tests/*.test.mjs`) — **110 tests, 0 deps** |
| Cron | Vercel cron → `/api/cron/reminders` |
| Email | Resend (optional, dry-run fallback) |
| 付款 | Stripe Checkout + webhook (optional, mock fallback) |

## 環境變量

複製 `.env.example` 到 `.env.local`,然後填:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # server-only, never expose

# Site
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Cron (required for 24h reminder to run)
CRON_SECRET=any-random-string           # also set in Vercel cron job config

# Stripe (optional, /packages works in mock mode without these)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_CURRENCY=HKD

# Resend email (optional, notifications dry-run without these)
RESEND_API_KEY=re_...
NOTIFY_EMAIL_FROM="SALON POKE BY VIVA <noreply@yourdomain.com>"

# Cancellation cutoff override (optional; otherwise reads from app_settings)
CANCEL_CUTOFF_HOURS=24

# Rate limiting for multi-instance prod (optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## 資料庫設定

1. 喺 [Supabase Dashboard](https://supabase.com/dashboard) 起新專案
2. SQL Editor 依次執行 `supabase/migrations/` 入面嘅 SQL(按檔名時間順序):
   - `20260813000100_salon_poke_core.sql` — core schema (profiles / admin_users / services / appointments / business_hours / blocked_dates)
   - `20260813000200_salon_poke_rls_storage.sql` — RLS + storage bucket
   - `20260905000000_customers_packages.sql` — customers + customer_packages
   - `20260905000001_appointments_customer_id.sql` — appointments.customer_id
   - `20260907000000_package_redeem_rpc.sql` — atomic `redeem_customer_package` + `refund_customer_package` RPC
   - `20260907000001_notifications_table.sql` — `notifications` audit log
   - `20260907000002_app_settings.sql` — runtime settings store (Settings page)
3. (可選) 跑 `supabase/seed-salon-poke-demo.sql` 載 demo 服務 + 套票
4. 開第一個 admin:
   ```sql
   insert into public.admin_users (user_id, is_active)
   values ('<auth.users.id>', true);
   ```
   或者用 `/admin` → 管理員 tab 邀請
5. 喺 Supabase Auth → URL Configuration 加 redirect:
   - `https://your-domain.com/auth/callback`
   - `https://your-domain.com/admin/login`

## 本地開發

```bash
npm install
npm run dev               # http://localhost:3000
```

```bash
# Test
npm test                  # 全部 unit tests (110)
npm run build             # 51 routes, 完整 build

# Lint
npm run lint

# Security scan
npm run security:scan
```

## 部署到 Vercel

1. Vercel dashboard Import `PANDORASPA/hk-salon-viva-fresh`
2. 設定上面嘅環境變量(尤其 `SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET`)
3. Vercel auto-detect Next.js,無需改 build command
4. 喺 Vercel Cron Jobs 加 cron target:
   - Path: `/api/cron/reminders`
   - Schedule: `0 * * * *` (每小時)
   - 加 query string: `?secret=<CRON_SECRET value>`
5. 第一次 push 之後每次 `git push origin master` 自動 deploy

詳細 launch runbook: `docs/launch-checklist-2026-09-07.md`

## 套票(package)流程

1. **Admin 派套票**:`/admin` → 套票 tab → 揀客戶 → 揀 template → 設定到期日
2. **客戶自助買單**(可選):啟用 Stripe 後 `/packages` 落單 → webhook → `customer_packages` row 自動產生
3. **客戶預約用套票**:`/booking` → 輸入電話 → 揀套票 → 揀服務 → 揀時段 → 確認
   - 後端 `applyRedemption()` 原子扣減 `sessions_remaining` + 寫 `package_redemptions`
4. **客戶取消預約**:`/account` → 取消
   - 後端 `reverseRedemption()` 自動退還一次
5. **餘額顏色**:綠(>25%) / 橙(≤25%) / 紅(耗盡)

## 路由地圖

### 公開
```
/                          首頁
/services                  服務列表
/booking                   公開預約
/booking/confirm?id=N      預約確認 + .ics
/packages                  套票 / Stripe 自助買單
/packages/success          付款成功
/gallery                   圖庫
/about                     關於
/contact                   聯絡
/location                  位置
/privacy                   私隱政策
/terms                     使用條款
/signin, /signup           登入 / 註冊
/forgot, /reset            忘記 / 重設密碼
/account                   客戶帳戶(預約 + 套票)
/account/bookings          預約歷史
/account/profile           個人檔案編輯
/sitemap.xml, /robots.txt  SEO
```

### Admin
```
/admin                     9-tab 後台
/admin/login               admin 登入
/admin/import              CSV 匯入(客戶 / 服務)
```

### API
```
GET  /api/availability              可用時段
POST /api/appointments               建立預約
GET  /api/appointments/[id]/ics      日曆檔
GET  /api/customers                  電話查客戶
GET  /api/packages                   套票 templates
GET  /api/health                     liveness probe
GET  /api/cron/reminders             Vercel cron target
POST /api/account/bookings/[id]      客戶改期
DELETE /api/account/bookings/[id]    客戶取消
POST /api/stripe/checkout            Stripe 落單
POST /api/stripe/webhook             Stripe webhook
GET  /api/admin/*                    後台 CRUD
GET  /api/admin/customers/[id]/export      GDPR 匯出
POST /api/admin/customers/[id]/gdpr-delete GDPR 硬刪除
GET  /api/admin/audit-logs           審計日誌
GET  /api/admin/settings             通知 / 預約設定
PATCH /api/admin/settings            更新設定
```

## 文件目錄

```
app/                    Next.js App Router pages + API routes
  page.js               主頁
  api/                  Route Handlers
  admin/                後台 shell + login
  account/              客戶帳戶
  auth/                 Supabase auth callback
  components/           共用 component(BrandIcons, Nav, Footer, admin modules)
  globals.css           全部樣式(冇用 Tailwind,純 CSS)

lib/
  admin/                admin context + audit log
  auth/                 admin 權限解析
  booking/              availability / package-usage / phase2 / salon-availability
  csv/                  RFC 4180 parser
  format.js             日期 / 價錢 / .ics formatter
  i18n/                 zh-HK / en dictionary + cookie-based locale
  notifications/        email (Resend) + notify dispatcher
  payments/             Stripe wrapper + mock fallback
  security/             request guards (rate limit)
  settings/             app_settings store
  supabase/             server / browser / admin / service clients
  time.js               time helpers
  validation/           input validators

content/                default services + identity
supabase/migrations/    7 SQL files in deploy order
supabase/seed-*.sql     demo data (optional)

tests/                  17 test files, 110 test cases, no test framework deps
docs/                   launch checklist + architecture + smoke reports
```

## 開發指南

- 全部 mutation 必須過 `lib/security/request-guards.js` 嘅 rate limit
- Admin 寫入必須用 `adminContext()` + 寫 `admin_audit_logs`
- 客戶面套票扣減必須用 `applyRedemption()` / `reverseRedemption()`(原子 RPC + legacy fallback)
- i18n 加新字串要 `zh-HK` + `en` 兩邊都加,跑 `npm test` 會 assert
- 唔好用 inline `font:` shorthand — 拆 `font-weight` / `font-size` / `line-height` / `font-family`
- 全部 Page components 預設 server component,'use client' 只用喺真正需要 state 嘅地方
- 跑 `npm test` 確保綠燈先 commit
- 改完試下 `npm run build`(51 routes,production build)先 push

## License

Proprietary — © SALON POKE BY VIVA.
