# SALON POKE BY VIVA — 爆毛術脫髮護理

香港脫髮護理及髮型服務網站。提供公開預約、套票（package ticket）管理、客戶帳戶、管理後台、審計日誌、Stripe 付款預備介面。

> **品牌**：`SALON POKE BY VIVA` + `爆毛術脫髮護理`  
> **域名**：`hk-salon-viva-fresh.vercel.app`（Vercel）  
> **Supabase project**：`khjjvjufwbmqymgzhbkl`

## 功能

- 公開預約系統（支援套票扣減、自動退還）
- 客戶管理 + 套票分配 + 套票餘額顏色提示（綠/橙/紅）
- 管理後台（8 個 tabs：預約 / 客戶 / 套票 / 服務定價 / 營業時間 / 圖庫 / 網站內容 / 管理員）
- Supabase 資料庫 + RLS 安全策略
- 審計日誌（`admin_audit_logs`）
- Stripe 整合（webhook 預備，可由 admin 改為自助買單）
- 公開確認頁 + `.ics` 加日曆
- 響應式設計 + 繁體中文 UI

## 技術架構

| 層 | 技術 |
|---|---|
| 前端 | **Next.js 16** (App Router) + React 18 |
| 後端 | Next.js Route Handlers (`/app/api/*`) |
| 資料庫 | **Supabase** (PostgreSQL 15) |
| 認證 | **Supabase Auth**（email + password） |
| 套票邏輯 | Postgres RPC + `lib/booking/package-usage.js` |
| 部署 | **Vercel**（推薦） |
| 測試 | `node --test` (`tests/*.test.mjs`) |

> **注意**：本 repo 嘅 `package.json` 同 `next.config.js` 已經對應 **Next.js 16**。舊 README 寫嘅「Next.js 14」係過時文案。Next.js 16 將 middleware 改為 `proxy.js`，`cookies()` 改為 `await cookies()` 等破壞性變更，請參閱 `node_modules/next/dist/docs/`。

## 環境變量

複製 `.env.example` 到 `.env.local`，然後填入：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional — shared rate limiting (multi-instance production)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional — Stripe (admin currently assigns packages manually; this enables
# public self-service purchase flow at /packages and webhook at /api/stripe/webhook)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CURRENCY=HKD
```

## 資料庫設定

1. 在 [Supabase Dashboard](https://supabase.com/dashboard) 建立新專案
2. 在 SQL Editor 依次執行 `supabase/migrations/` 入面嘅 SQL（依檔名時間順序）：
   - `20260813000100_salon_poke_core.sql` — core schema
   - `20260813000200_salon_poke_rls_storage.sql` — RLS + storage
   - `20260905000000_customers_packages.sql` — customers + packages
   - `20260905000001_appointments_customer_id.sql` — appointments + customer_id
   - `20260907000000_package_redeem_rpc.sql` — atomic redemption RPC
3. （可選）執行 `supabase/seed-salon-poke-demo.sql` 載入示範服務同套票
4. 喺 Supabase Dashboard → SQL Editor 加 admin：

   ```sql
   insert into public.admin_users (user_id, is_active)
   values ('<auth.users.id>', true);
   ```

   或者用 `/admin` 入面「管理員」tab 邀請。

## 本地開發

```bash
# 1) 安裝
npm install

# 2) 啟動
npm run dev

# 3) 開瀏覽器
# 公開：http://localhost:3000
# 後台：http://localhost:3000/admin
```

## 測試

```bash
# 全部 unit / smoke
npm test

# 個別
node --test tests/booking-form.test.mjs
node --test tests/admin-auth.test.mjs
```

## 部署到 Vercel

1. 喺 Vercel dashboard Import 呢個 GitHub repo
2. 設定環境變量（同 `.env.local`）
3. 設定 build command: `npm run build`（預設）
4. 設定 Supabase Auth redirect URL：
   - `https://your-domain.com/auth/callback`
   - `https://your-domain.com/admin/login`
5. Deploy

## 套票（package）功能

1. **管理員派套票**：`/admin` → 套票 tab → 揀客戶 → 揀套票模板 → 設定到期日
2. **客戶自助買單（可選）**：啟用 Stripe 後 `/packages` 落單 → webhook → `customer_packages` row 自動產生
3. **客戶預約時用套票**：`/booking` → 輸入電話 → 揀套票 → 揀服務 → 揀時段 → 確認
   - 後端 `applyRedemption()` 原子扣減 `sessions_remaining` + 寫 `package_redemptions`
4. **客戶取消預約**：`/account` → 取消
   - 後端 `reverseRedemption()` 自動退還一次
5. **餘額顏色**：
   - 綠色 `#27ae60` 充足（剩餘 > 25%）
   - 橙色 `#e67e22` 緊張（剩餘 ≤ 25%）
   - 紅色 `#c0392b` 耗盡

## 管理後台

`/admin/login` → 用 Supabase Auth 登入 → 8 個 tabs：

| Tab | 功能 |
|---|---|
| 預約 | List / 改 status / 取消 / 標 attended |
| 客戶 | List / 搜尋 / 編輯 profile / 派套票 / GDPR export / GDPR delete |
| 套票 | List / 編輯 templates / 啟停 |
| 服務定價 | CRUD 服務 + 設定 default location / provider group |
| 營業時間 | shop `days_off` / staff weekly / staff_time_off / blocked_slots |
| 圖庫 | List / upload / delete（Supabase Storage） |
| 網站內容 | 編輯 `site_content.data` JSONB（hero / contact / brand） |
| 管理員 | List / 邀請新 admin / 啟停 |

所有 admin 寫入動作會記錄喺 `admin_audit_logs`（`actor_user_id`, `action`, `target_table`, `target_id`, `before_data`, `after_data`, `ip`, `user_agent`）。

## 路由地圖

```
/                       首頁
/services               服務列表
/booking                公開預約
/booking/confirm?id=N   預約確認 + .ics
/gallery                圖庫
/about                  關於我們
/contact                聯絡
/privacy                私隱政策
/terms                  使用條款
/location               地點
/signin, /signup        登入 / 註冊
/account                客戶帳戶（預約、套票餘額）
/admin, /admin/login    管理後台
/sitemap.xml, /robots.txt   SEO

/api/availability       GET：可用時段
/api/appointments       POST：建立預約
/api/appointments/[id]/ics  GET：.ics 日曆檔
/api/customers          GET：電話查客戶
/api/packages           GET：套票 templates
/api/admin/*            管理後台 CRUD
```

## 架構詳情

睇 [`docs/architecture.md`](./docs/architecture.md) 同 [`docs/architecture-diagram.txt`](./docs/architecture-diagram.txt)。

## 開發指南

- 用 `<Link>` 走 RSC navigation（避免全頁 reload）
- 唔好用 inline `font:` shorthand — 拆 `font-weight` / `font-size` / `line-height` / `font-family`
- 客戶面嘅 mutation 必須喺 `lib/booking/package-usage.js` 集中處理
- Admin 寫入必須包 `tryWriteAdminAuditLog()`
- 跑 `npm test` 確保 unit test 綠燈先 commit

## License

Proprietary — © SALON POKE BY VIVA.
