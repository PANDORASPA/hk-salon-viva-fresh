# VIVA HAIR 今日 6-Agent Smoke 執行表

## 使用方式
- 今日先以真資料 smoke 為主，不開新功能。
- 所有自動化 smoke 與人工驗證固定打 `http://localhost:3000`。
- 本地 server 必須用本 repo 與正確 `.env.local` 啟動。
- 每條 case 都要記錄：
  - `staff_id`
  - `service_id`
  - `date`
  - 如有需要再補 `location_id` / `resource_id`
- 每次後台修改設定後，固定流程：
  1. 儲存
  2. refresh 後台
  3. 打開前台 booking 頁
  4. 檢查 datepicker 狀態
  5. 檢查 `month-summary.status / reason`
  6. 如可預約，再檢查時間下拉

## Severity 規則
- `pass`：結果完全符合預期
- `P3`：純 UI / 文案 / 排版問題
- `P2`：前後台結果大致正確，但提示、快取、或顯示層有誤導
- `P1`：後台儲存成功，但前台結果不對照
- `P0`：booking truth / auth / data corruption

## Gate 規則
- 只有少量 `P2/P3`：`Conditional GO`
- 全綠：`GO`
- 任一 `P0/P1`：`NO-GO`

---

## Agent 1：Weekly Schedule 上班日 -> `available`
- Owner:
- `staff_id`:
- `service_id`:
- `date`:
- 後台設定：
  - 上班時間：
  - 下班時間：
  - 無休息 / 無休假 / 無封鎖：
- 預期：
  - `month-summary.status = available`
  - 前台日期可選
  - 時間下拉有正確時段
  - 最後可約時段跟下班時間一致
- 實際：
  - `month-summary.status`:
  - `month-summary.reason`:
  - `availableCount`:
  - slots:
  - 前台日期狀態：
  - 前台時間下拉狀態：
- Refresh 後結果：
- Severity:
- Follow-up:

## Agent 2：Weekly Schedule 休息日 -> `off`
- Owner:
- `staff_id`:
- `service_id`:
- `date`:
- 後台設定：
  - 休息日 / 無排班 / 假期：
- 預期：
  - `month-summary.status = off`
  - 前台日期灰色不可選
  - 不應再打單日 availability
- 實際：
  - `month-summary.status`:
  - `month-summary.reason`:
  - 前台日期狀態：
  - 是否仍可點：
  - 是否仍載入時段：
- Refresh 後結果：
- Severity:
- Follow-up:

## Agent 3：有班但已滿 / 資源滿 -> `full`
- Owner:
- `staff_id`:
- `service_id`:
- `date`:
- `resource_id`:
- 後台設定：
  - 上班時間：
  - 已有 booking / resource full：
- 預期：
  - `month-summary.status = full`
  - 前台顯示 `已滿`
  - 不可誤判成 `休息`
  - 訊息可解釋
- 實際：
  - `month-summary.status`:
  - `month-summary.reason`:
  - `availableCount`:
  - 前台日期狀態：
  - 前台畫面訊息：
- Refresh 後結果：
- Severity:
- Follow-up:

## Agent 4：日期覆蓋，休息改上班
- Owner:
- `staff_id`:
- `service_id`:
- `date`:
- 後台設定：
  - 原本 weekly 狀態：
  - override 內容：
  - override 後上班時間：
  - override 後下班時間：
- 預期：
  - 原本 `off` 的日期變成 `available` 或 `full`
  - 前台不再顯示休息
  - 如有位可載入時段
- 實際：
  - `month-summary.status`:
  - `month-summary.reason`:
  - slots:
  - 前台日期狀態：
  - 前台時間下拉狀態：
- Refresh 後結果：
- Severity:
- Follow-up:

## Agent 5：Break / Time Off / Blocked Slot 只扣部分時段
- Owner:
- `staff_id`:
- `service_id`:
- `date`:
- 後台設定：
  - 上班時間：
  - 下班時間：
  - 固定休息時段：
  - 休假時段：
  - 封鎖時段：
- 預期：
  - 不應整日變 `off`
  - 只扣減部分時段
  - slots 與設定對照
- 實際：
  - `month-summary.status`:
  - `month-summary.reason`:
  - `availableCount`:
  - slots:
  - 前台日期狀態：
  - 前台時間下拉狀態：
- Refresh 後結果：
- Severity:
- Follow-up:

## Agent 6：QA / Gate Keeper
- Owner：Codex / 今日自動化執行主線
- Build：
- Smoke 完成數：
- `P0`:
- `P1`:
- `P2`:
- `P3`:
- Blocking findings:
- Known issues:
- 最終 Decision:

---

## 共通補充檢查
- Staff / holiday / service / resource 儲存後，前台是否仍顯示舊 cache：
  - `yes / no`
- 修改下班時間後，最後可約時段是否同步變：
  - `yes / no`
- `full` 是否清楚區分於 `off`：
  - `yes / no`
- 前台是否仍有亂碼 / 高頻英文殘留：
  - `yes / no`
- 是否影響 booking create：
  - `yes / no`

---

## 今日已執行的自動化結果
### `npm run build`
- 結果：`pass`
- 已成功通過 production build

### `node scripts/phase2-live-smoke.mjs --base-url=http://localhost:3000`
- 結果：`pass`
- 核心通過項目：
  - `controlled_booking_create`
  - `controlled_booking_reschedule`
  - `controlled_booking_cancel`
  - `bookings_detail_seed_ready`
  - `transaction_edit_save_roundtrip`
  - `customer_operational_seed_ready`
  - `availability_resource_full`
  - `holiday_provider_group_enforcement`
- 報告：
  - [LIVE_SMOKE_REPORT_2026-03-19.json](/C:/Users/Administrator/Desktop/viva/Hair-salon/LIVE_SMOKE_REPORT_2026-03-19.json)

### `node scripts/release-gate-smoke.mjs --base-url=http://localhost:3000`
- 結果：`NO-GO`
- 通過：
  - `booking_create_success`
  - `booking_create_duplicate_conflict`
  - `booking_create_resource_full`
  - `reschedule_self_exclusion`
  - `reschedule_success_allocation_rebuild`
  - `account_cancel_ticket_restore`
  - `account_ownership_denial`
  - `auth_admin_guard`
- 唯一 blocker：
  - `reschedule_rollback_failure`
    - `response_status = 200`
    - `rollback_verified = false`
    - sabotage 後 booking 仍被改到 `2026-03-29 09:00`
- 報告：
  - [RELEASE_GATE_REPORT_2026-03-19.json](/C:/Users/Administrator/Desktop/viva/Hair-salon/RELEASE_GATE_REPORT_2026-03-19.json)

---

## 2026-03-20 根因追查 Round 更新

### 已完成修正
- `parseBusinessHours` 已在 [app/admin/page.js](/C:/Users/Administrator/Desktop/viva/Hair-salon/app/admin/page.js) 正式引入
- [app/api/public/booking-bootstrap/route.js](/C:/Users/Administrator/Desktop/viva/Hair-salon/app/api/public/booking-bootstrap/route.js) 已補 `staff.location_id` / `provider_group_id`
- [app/api/availability/_summary.js](/C:/Users/Administrator/Desktop/viva/Hair-salon/app/api/availability/_summary.js) 已移除 `staff.daysOff` / `break_start` / `break_end` 的 live schema 依賴
- [app/booking/[staffId]/page.js](/C:/Users/Administrator/Desktop/viva/Hair-salon/app/booking/[staffId]/page.js) 已補 compact datepicker 主線的高頻繁中文案
- smoke scripts 已統一：
  - host：`http://localhost:3000`
  - auth preflight
  - environment probe
  - diagnostic categories

### 目前根因判定
- `controlled_booking_create = 401`：已清除，正確本地 server 下為 `pass`
- `availability / holiday = 500`：已清除，正確本地 server 下為 `pass`
- `No create slot available`：已清除，create baseline 目前可找到 slot
- 現在唯一 release blocker 係：
  - `reschedule_rollback_failure`

### 今日 Gate
- 目前判定：`NO-GO`
- 原因：
  - rollback sabotage 路徑仍會回 `200`
  - booking / allocation 未證明完整回滾
- 下一步：
  1. 進入 rollback hotfix round
  2. 修 [app/api/account/bookings/[id]/route.js](/C:/Users/Administrator/Desktop/viva/Hair-salon/app/api/account/bookings/[id]/route.js) 的 forced-failure restore path
  3. 重跑 `release-gate-smoke`
