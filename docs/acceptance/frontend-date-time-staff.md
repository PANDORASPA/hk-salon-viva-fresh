# 前台日期 / 時間 / 服務供應者排班對照驗收模板

## 基本資料
- 日期：
- Owner / Agent：
- 環境：
- `staff_id`：
- `service_id`：
- `date`：
- `month`：
- `location_id`：
- 測試目的：

## 後台設定快照
- 每週時間表：
- 日期覆蓋：
- 固定休息時段：
- 休假時段：
- 封鎖時段：
- 假期 / holiday：
- 服務可約範圍：
- 資源狀態：
- 其他備註：

## 共通驗收欄位
- `month_summary.status`：
- `month_summary.reason`：
- `month_summary.availableCount`：
- 單日 availability slots：
- 前台 datepicker 狀態：
- 前台時間下拉狀態：
- 前台畫面訊息：
- 載入耗時（ms）：
- findings severity：
- follow-up：

## 5 組 Smoke 驗收模板

### 1. 有上班，而且有可預約時段
- `staff_id`：
- `service_id`：
- `date`：
- 後台設定值：
  - 上班時間：
  - 下班時間：
  - 無休息 / 無假期 / 無封鎖：
- `month_summary.status`：`available`
- `month_summary.reason`：
- `month_summary.availableCount`：
- 單日 availability slots：
- 前台 datepicker 狀態：
  - 日期顏色：
  - 是否可點：
  - 是否高亮：
- 前台時間下拉狀態：
  - 是否顯示：
  - 時間是否正確：
  - 是否可選：
- 前台畫面訊息：
  - 是否顯示「載入可預約時段中」：
  - 是否顯示時段清單：
  - 是否可直接提交：
- findings severity：`pass / P3 / P2 / P1 / P0`
- 備註：

### 2. 沒上班 / 休息日
- `staff_id`：
- `service_id`：
- `date`：
- 後台設定值：
  - 該日休息 / 無排班 / 假期：
- `month_summary.status`：`off`
- `month_summary.reason`：
- `month_summary.availableCount`：
- 單日 availability slots：
- 前台 datepicker 狀態：
  - 日期顏色：
  - 是否可點：
  - 是否顯示「休息」：
- 前台時間下拉狀態：
  - 是否顯示：
  - 是否為 disabled：
- 前台畫面訊息：
  - 是否顯示「該日休息」：
  - 是否避免再打單日 availability：
- findings severity：`pass / P3 / P2 / P1 / P0`
- 備註：

### 3. 有上班，但已滿
- `staff_id`：
- `service_id`：
- `date`：
- 後台設定值：
  - 上班時間：
  - 已有 booking / resource full / buffer 佔滿：
- `month_summary.status`：`full`
- `month_summary.reason`：
- `month_summary.availableCount`：
- 單日 availability slots：
- 前台 datepicker 狀態：
  - 日期顏色：
  - 是否可點：
  - 是否顯示「已滿」：
- 前台時間下拉狀態：
  - 是否顯示：
  - 是否為空狀態：
  - 是否仍可保留該日選取：
- 前台畫面訊息：
  - 是否顯示「有上班，但今天已滿」：
  - 是否避免誤判成休息：
- findings severity：`pass / P3 / P2 / P1 / P0`
- 備註：

### 4. 日期覆蓋由休息改成上班
- `staff_id`：
- `service_id`：
- `date`：
- 後台設定值：
  - 原本日狀態：
  - 日期覆蓋內容：
  - 覆蓋後上班時間：
- `month_summary.status`：
- `month_summary.reason`：
- `month_summary.availableCount`：
- 單日 availability slots：
- 前台 datepicker 狀態：
  - 重新載入後日期狀態：
  - 是否由灰轉黑：
  - 是否仍然顯示休息：
- 前台時間下拉狀態：
  - 是否更新：
  - 是否反映新時段：
- 前台畫面訊息：
  - 是否正確刷新：
  - 是否仍然灰色：
- findings severity：`pass / P3 / P2 / P1 / P0`
- 備註：

### 5. 固定休息 / 休假 / 封鎖只扣部分時段
- `staff_id`：
- `service_id`：
- `date`：
- 後台設定值：
  - 上班時間：
  - 下班時間：
  - 固定休息時段：
  - 休假時段：
  - 封鎖時段：
- `month_summary.status`：
- `month_summary.reason`：
- `month_summary.availableCount`：
- 單日 availability slots：
- 前台 datepicker 狀態：
  - 是否仍顯示為可預約日期：
  - 是否被錯誤判成整日休息：
- 前台時間下拉狀態：
  - 是否只剩部分時段：
  - 是否正確扣減：
  - 是否仍可選正確時段：
- 前台畫面訊息：
  - 是否顯示部分可約而非整日休息：
  - 是否與後台設定一致：
- findings severity：`pass / P3 / P2 / P1 / P0`
- 備註：

## 總結
- 本次 smoke 結論：
- 是否有 booking truth regression：
- 是否有 UI / 文案問題：
- 是否有效能問題：
- 是否需要 hotfix：
- 最終 Decision：`GO / Conditional GO / NO-GO`
