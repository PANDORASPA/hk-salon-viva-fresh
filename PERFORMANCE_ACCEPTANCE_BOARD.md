# VIVA HAIR Performance Acceptance Board

## Purpose
用於記錄全站性能修復前後的真資料驗收，特別針對：
- 前台預約月曆與時段載入
- `/admin` 首屏載入
- staff / locations / holidays / resources / services / transactions 等設定儲存

## Severity
- `P0`: booking truth / auth / data corruption
- `P1`: create / reschedule / save regression
- `P2`: 仍然過慢、快取失效、畫面 stale 超過接受範圍
- `P3`: 純 loading copy / skeleton / UI polish

## Timing Log Template

```md
### YYYY-MM-DD
- owner:
- route:
- action:
- seed_data:
- before_ms:
- after_ms:
- result:
- severity:
- notes:
```

## Core Scenarios

### Frontend Booking
- `/booking/[staffId]` 首次月曆載入
- 同月切日期
- 同 staff 切兩個 service
- `off` / `full` 日期不再打單日 availability

### Admin
- `/admin` 首屏載入
- 進入 `預約`
- 進入 `顧客`
- 進入 `交易紀錄`
- 進入 `分析`

### Save Lanes
- staff save
- holidays save
- resources save
- services save
- transactions save
- inventory save
- coupons save

## Daily Evidence

### Day 1
- owner:
- route:
- action:
- seed_data:
- before_ms:
- after_ms:
- result:
- severity:
- notes:

### Day 2
- owner:
- route:
- action:
- seed_data:
- before_ms:
- after_ms:
- result:
- severity:
- notes:

### Day 3
- owner:
- route:
- action:
- seed_data:
- before_ms:
- after_ms:
- result:
- severity:
- notes:
