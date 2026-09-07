# SALON POKE BY VIVA — Project documentation

This folder holds the operational, historical, and acceptance docs for the site.
Application source code lives in `app/`, `lib/`, `content/`, and `supabase/`.

## Layout

```
docs/
  README.md                    ← you are here
  architecture.md              ← system diagram + data model + file map
  launch-checklist.md          ← what to verify before going live
  launch-report-2026-09-07.md  ← record of the most recent code freeze
  phase2-smoke-checklist.md    ← manual smoke tests for the booking engine
  supabase-setup-order.md      ← canonical migration order + legacy notes
  validation-report.md         ← last live-schema validation snapshot
  acceptance/                  ← pre-launch acceptance boards
    controlled-live-use-3-day.md
    frontend-date-time-staff.md
    staff-frontend-datepicker.md
    performance.md
  archive/                     ← historical boards retained for traceability
    admin-traditional-chinese-acceptance.md
    palacehairspa-replacement-acceptance.md
    6-agent-smoke-execution-sheet.md
  smoke/                       ← per-day live smoke JSON (gitignored)
```

## Brand

The site is **SALON POKE BY VIVA**, a Hong Kong hair loss treatment studio
specialising in 爆毛術 (hair regrowth). The old brand names (PANDORA
HEAD SPA, PALACE HAIR SPA, VIVA Hair Salon) that appear in `archive/`
are retained for traceability only — no new copy should mention them.
