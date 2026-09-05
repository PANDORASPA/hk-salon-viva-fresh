# SALON POKE BY VIVA — 爆毛術脫髮護理

香港脫髮護理及髮型服務網站。功能包括：

- 公開預約系統（支援套票扣減）
- 客戶管理 + 套票分配
- 管理後台（預約/客戶/套票/服務/圖庫）
- Supabase 資料庫 + RLS 安全策略
- 審計日誌

## 技術架構

- **前端**: Next.js 14 (App Router)
- **資料庫**: Supabase (PostgreSQL)
- **認證**: Supabase Auth
- **部署**: Vercel（推薦）或任何 Node.js 平台

## 環境變量

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## 資料庫設定

1. 在 Supabase 建立新專案
2. 執行 Migration：
   ```bash
   supabase db push
   ```
   或在 Supabase Dashboard → SQL Editor 依次執行：
   - `supabase/migrations/20260905000000_customers_packages.sql`
   - `supabase/migrations/20260905000001_appointments_customer_id.sql`
3. 執行 Seed 數據：
   - `supabase/seed-salon-poke.sql`

## 本地開發

```bash
npm install
npm run dev
```

## 部署到 Vercel

1. Fork 或上傳代碼到 GitHub
2. 在 Vercel Import Repository
3. 設定環境變量
4. Deploy

## 套票功能

- 客戶致電或 WhatsApp 聯絡，由管理員在後台分配套票
- 客戶預約時可選擇使用套票（系統自動扣減）
- 套票餘額顏色提示：綠色（充足）→ 橙色（少於25%）→ 紅色（耗盡）

## 管理後台

訪問 `/admin/login`，使用 Supabase Auth 帳戶登入。

如需新增管理員，在 Supabase Dashboard → Authentication → Users 手動設定 `admin_users` 角色。
