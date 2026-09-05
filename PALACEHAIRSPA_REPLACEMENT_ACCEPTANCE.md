# PANDORA HEAD SPA 替代網站驗收清單

這份清單用來確認新的 PANDORA HEAD SPA 網站是否已可取代原 Palace Hair Spa 公開網站與日常營運流程。參考來源為 `www.palacehairspa.com` 的可見定位：`PANDORA HEAD SPA｜全自助頭皮護理中心`。

## 前台完整度

- 首頁首屏清楚呈現 `PANDORA HEAD SPA 全自助頭皮護理中心`、聯絡方式、營業時間與主要預約 CTA。
- 頭皮護理服務、套票、產品、護理團隊、文章 / 最新消息、FAQ、聯絡內容齊備，並使用正式文案。
- 主選單顯示已批准的顧客入口。
- 電話、地址、Google Map、社交平台、WhatsApp 等連結指向正確正式資料。
- 重要舊網址或外部入口已有對應新導覽或 redirect 策略。
- 上線前不得保留 placeholder 圖片、Lorem ipsum、測試價目、舊 salon 語境或 sample-only 標籤。

## 預約

- 訪客或會員可從所有主要入口開始預約。
- 會員可選擇頭皮護理服務、服務人員、日期和可用時段，不會看到已封鎖或無效時段。
- 建立預約時會儲存正確會員、服務、人員、日期、開始時間、結束時間、服務時長與緩衝時間。
- 預約完成提示清楚，並會出現在會員中心。
- 會員只能取消或更改自己的預約。
- 系統能處理人員不可用、已被預約、休息時間、請假、重複提交和過期可用時段。
- Admin 後台可看到新預約，並顯示顧客、服務、付款與套票資訊。

## 套票與付款

- 套票列表顯示正確名稱、描述、價格、有效期、使用規則與是否可購買。
- 會員購買套票後會建立與會員綁定的訂單。
- 只有 Stripe 成功付款或 admin 人工確認付款後，才會發放可用套票。
- 未付款套票訂單保持等待付款狀態，不會建立可用權益。
- 會員中心可顯示持有套票、餘額、狀態、到期日、購買來源與使用紀錄。
- 預約時只能使用本人有效、未過期、有餘額且服務匹配的套票。
- 套票扣次和取消回補都要寫入 `ticket_redemptions`。

## 會員中心

- 註冊會建立會員 profile，登入後導向正確會員體驗。
- 會員中心顯示個人資料、預約、訂單、套票與會員狀態。
- 會員資料不可依賴 browser 儲存的 user object 作權限來源。
- 會員不可查看、取消、更改或使用其他會員的資料。
- 登出後 protected pages 要求重新登入。
- 空狀態、載入中、錯誤、未付款、付款取消、未登入等狀態都有清楚提示。

## Admin 匯入與付款確認

- Admin-only route 必須要求已登入 admin profile，並拒絕普通會員。
- 舊套票 CSV 匯入固定接受：`email`, `phone`, `full_name`, `ticket_name`, `service_name`, `remaining_count`, `expiry_date`, `note`。
- 匯入前要校驗必填欄位、格式錯誤與逐行錯誤，不可未預覽就改正式資料。
- 匯入流程要可重跑，或清楚防止重複誤導入。
- Admin 可確認合資格套票付款，並看到訂單與會員套票狀態改變。
- Stripe 套票成功付款會經 webhook 自動建立會員套票。
- 確認付款、CSV 匯入、設定修改等 admin 操作要有 actor、timestamp、target record 和結果狀態紀錄。
- 失敗或部分完成的匯入 / 確認流程要保持可追查、可恢復。

## 手機版

- 前台、預約、會員中心與 admin 重要視圖在常見手機寬度可用。
- 導航、表單、日曆 / 日期控制、套票卡和會員表格不可爆版或遮擋重要操作。
- 點擊目標大小足夠，表單欄位能觸發合適手機鍵盤。
- 預約和付款確認流程可在手機完成。
- 手機 smoke 至少覆蓋一個 iOS 尺寸與一個 Android 尺寸。

## SEO 與分享

- 每個公開頁都有正式 title 和 description。
- Canonical URL、robots、sitemap 與結構化資料適合正式上線。
- 品牌名、服務名、地址、電話、營業時間可被搜尋引擎讀取。
- Open Graph / 社交分享 metadata 使用正式圖片與文案。
- 已移除或改名的公開 route 有 redirect 或替代入口，避免客戶與搜尋流量中斷。
- 公開 metadata 不應出現 staging、localhost 或 sample URL。

## API / 付款 / 安全

- Vercel env 指向正確 Supabase project、Stripe account 和公開網站 URL。
- `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`、Upstash token 只放 server env，不放後台 settings。
- `/api/public/settings` 不回傳任何 secret，只回傳啟用狀態與 readiness。
- Stripe webhook 要驗 signature、timestamp tolerance、訂單狀態與 idempotency。
- 高風險 mutating API 要有 same-origin guard 和 rate limit。
- Admin 操作要寫入 audit log。
- 普通會員不能直接寫入營運表或進入 `/admin`。

## 上線

- 正式 migration 已依序套用，production database 有必要 admin 和內容資料。
- `npm run build`、`npm run security:scan`、dependency audit 都通過。
- Desktop / mobile smoke 覆蓋公開導覽、預約、套票購買、會員中心、admin 匯入與付款確認。
- 正式內容、價目、人員排班、套票條款與聯絡資料已由業主批准。
- Rollback、DNS、redirect 和上線後監控負責人已記錄。
- 只有當前台、預約、套票、會員、admin、手機、SEO、Stripe、Supabase 與 smoke 全部通過後，才可視為正式可 launch。
