# Staff 排班 -> 前台 Datepicker -> Slots 真資料 Smoke Board

## 目標
- 驗證後台排班設定會真實反映到前台日期狀態與時段下拉。
- 驗證 `available / full / off / reason` 的顯示一致。
- 驗證 staff / holiday / service / resource 儲存後，前台 stale cache 會被清掉。

## 6-Agent 分工
- Agent 1：`weekly schedule` 上班 / 休息基本路徑
- Agent 2：`full / resource_full / fully_booked` 路徑
- Agent 3：`date override` 由休息改上班
- Agent 4：`break / time off / blocked slot` 扣減部分時段
- Agent 5：`service / provider / location / resource` 對照與 stale cache 檢查
- Agent 6：彙總 evidence、severity、最終 `GO / Conditional GO / NO-GO`

## 每日執行規則
- 每日最少跑 5 組場景。
- 每次修改後台設定後，必做：
  - 儲存
  - refresh 後台
  - 前台重新開啟 datepicker 或切回頁面
  - 記錄 `month-summary.status/reason`
  - 記錄單日 slots
- 每一條都要有真資料 id：
  - `staff_id`
  - `service_id`
  - `date`
  - 如有需要：`location_id` / `resource_id`

## Day 1
### Agent 1
- Scope：weekly schedule 上班 / 休息
- Seeds：
  - `staff_id`：
  - `service_id`：
  - `date_available`：
  - `date_off`：
- Result：
  - `available`：
  - `off`：
  - Severity：
  - Follow-up：

### Agent 2
- Scope：有班但已滿
- Seeds：
  - `staff_id`：
  - `service_id`：
  - `date_full`：
- Result：
  - `month-summary.status`：
  - `month-summary.reason`：
  - 前台提示：
  - Severity：
  - Follow-up：

### Agent 6
- 今日結論：
- `GO / Conditional GO / NO-GO`：
- Blocking findings：

## Day 2
### Agent 3
- Scope：日期覆蓋由休息改上班
- Seeds：
  - `staff_id`：
  - `service_id`：
  - `date_override`：
- Result：
  - 後台 refresh 後：
  - 前台 datepicker：
  - 單日時段：
  - Severity：
  - Follow-up：

### Agent 4
- Scope：固定休息 / 休假 / 封鎖只扣部分時段
- Seeds：
  - `staff_id`：
  - `service_id`：
  - `date_partial`：
- Result：
  - `month-summary.status`：
  - `availableCount`：
  - slots：
  - Severity：
  - Follow-up：

### Agent 6
- 今日結論：
- `GO / Conditional GO / NO-GO`：
- Blocking findings：

## Day 3
### Agent 5
- Scope：service / provider / location / resource 對照與 stale cache
- Seeds：
  - `staff_id`：
  - `service_available_id`：
  - `service_full_or_limited_id`：
  - `date`：
- Result：
  - 切 service 前：
  - 切 service 後：
  - cache 是否刷新：
  - `reason` 是否合理：
  - Severity：
  - Follow-up：

### Agent 6
- 今日結論：
- `GO / Conditional GO / NO-GO`：
- Known P2：
- Known P3：

## 統一記錄欄位
- `staff_id`
- `service_id`
- `date`
- `後台設定值`
- `month-summary.status`
- `month-summary.reason`
- `month-summary.availableCount`
- `單日 availability slots`
- `前台 datepicker 狀態`
- `前台時間下拉狀態`
- `前台畫面訊息`
- `stale cache cleared: yes/no`
- `severity: pass / P3 / P2 / P1 / P0`
- `owner`
- `follow-up`

## Severity 規則
- `P0`：booking truth / auth / data corruption
- `P1`：後台儲存成功，但前後台狀態明顯不對照
- `P2`：reason / 文案 / cache 刷新仍有誤導
- `P3`：純 UI / 文案 / 排版

## 最終判定
- 無 `P0/P1`，只剩少量 `P2/P3`：`Conditional GO`
- 全綠：`GO`
- 有 `P0/P1`：`NO-GO`
