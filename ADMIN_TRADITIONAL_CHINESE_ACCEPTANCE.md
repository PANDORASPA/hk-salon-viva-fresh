# VIVA HAIR Admin 繁體中文化驗收板

## 驗收範圍
- `/admin` 主導航與分組頁籤
- 預約、訂單、交易紀錄、顧客
- 服務供應者、假期、地點、資源設備
- 總覽、分析
- 共用 records shell、filter bar、detail panel、empty state、warning state

## 6-Agent 驗收分工
### Agent 1：預約 / 訂單 / 交易紀錄
- 檢查 section header、filter label、status label、detail label 是否為繁體中文
- 檢查 badge、empty state、warning copy 無英文高頻殘留
- 保留 `TX #`、`payment_ref`、ID 等技術字串，不視為缺陷

### Agent 2：顧客 / 會員營運
- 檢查顧客 summary、最近活動、內部備註、可見消費、套票 / 套餐
- 檢查 notes save feedback、empty state、活動類型名稱
- 確保用字一致採用香港營運語境

### Agent 3：服務供應者 / 假期 / 排程
- 檢查服務供應者資料、可分派地點、可用服務供應者群組、固定休息時段、休假時段、封鎖時段
- 檢查假期 targeting summary、warning copy、unavailable state
- 不可出現英中混用或簡體字

### Agent 4：總覽 / 分析
- 檢查 KPI 標題、圖表標題、說明文字、empty state
- 檢查 booking revenue / order revenue / transaction revenue 語意清楚
- 確保 `今日預約`、`預約營業額`、`商品營業額`、`活躍顧客`、`套票使用` 用字一致

### Agent 5：Admin Shell / 共用元件
- 檢查 `SectionHeader`、`RecordFilterBar`、button copy、warning banner、empty state
- 檢查桌面與手機版有沒有 button overflow、badge 截斷、detail label 走位
- 清點同一概念是否出現多種譯法

### Agent 6：QA / Controlled Live Use 中文化驗收
- 跟住 controlled live use checklist 抽樣跑關鍵流程
- 記錄英中混雜、簡體字、語意誤譯、版面溢出
- 最終給出 `GO / Conditional GO / NO-GO`

## 缺陷分級
- `P0`：中文化造成流程不可用、按鈕不可操作、資料無法辨識
- `P1`：語意誤譯導致營運判斷錯誤
- `P2`：高頻操作文案仍殘留英文或同義字不一致
- `P3`：低頻英文、版面截斷、字距或按鈕文案不夠統一

## 驗收清單
- 主要導航、頁面標題、summary cards 已改為繁體中文
- records filter、detail、empty state、warning state 無高頻英文殘留
- dashboard / analytics KPI title 與說明為繁體中文
- staff / holidays / scheduling 無英中混用
- 中文字串不令 button overflow、badge 截斷、detail label 走位
- 中文化不影響 booking create / reschedule / auth guard / records linkage
- `npm run build` 成功

## 每日紀錄格式
```md
### Agent X
- page:
- scenario:
- expected:
- actual:
- severity:
- owner:
- follow_up:
```
