# Phase 2 Smoke Checklist

## Acceptance Board

For daily controlled live use after release gate, pair this checklist with [CONTROLLED_LIVE_USE_3_DAY_ACCEPTANCE_BOARD.md](/C:/Users/Administrator/Desktop/viva/Hair-salon/CONTROLLED_LIVE_USE_3_DAY_ACCEPTANCE_BOARD.md).

| Area | Scenario | Pass criteria | Fail signal |
| --- | --- | --- | --- |
| Service relation save | Add/edit/delete location, provider group, and resource links; refresh admin | Saved relations persist; deleted rows do not reappear | Ghost rows, missing links after refresh, or save rollback |
| Availability / provider mismatch | Request `/api/availability` with `staffId` outside service provider group | No slots returned | Staff still appears bookable |
| Availability / resource full | Occupy a required resource and request the same slot again | Slot disappears or returns a `resource_full` style conflict | Slot still shown as available |
| Holiday scope | Create a holiday scoped to a provider group and inspect affected staff/slots | Holiday blocks apply only to the targeted provider group, plus any linked location/staff filters | Holiday scope ignores provider-group targeting |
| Bookings filters | Use bookings search, status, location, provider group, and service filters | Each filter narrows the visible list without breaking row detail or selection | Filters are ignored, inconsistent, or reset detail state |
| Booking detail context | Open booking detail in admin | Location, provider group, and resource allocation context are visible | Detail only shows legacy staff/service data |
| Orders / transactions consistency | Inspect matching order and transaction records for one booking | Booking, order, and transaction references line up and totals stay server-derived | Broken linkage, mismatched totals, or missing payment context |
| Customers operational view | Open a customer row with booking/order history | Recent booking, order, and ticket context are visible enough for ops follow-up | Customer view lacks operational history or shows stale linkage |
| Transaction edit/save roundtrip | Edit one transaction row, save, then refresh admin | Linked booking/order/customer context still resolves after save and refresh | Save succeeds but linkage or totals drift after refresh |
| Staff scope mapping | Open a staff row after refresh | Assignable locations and provider groups still resolve to human-readable labels | Scope chips disappear, regress to raw ids, or mismatch staff rules |
| Build regression | Run `npm run build` | Build passes end to end | Build fails or route/component compile errors appear |

## Preconditions
- Run latest Supabase migrations, including:
  - `supabase/migrations/20260319000300_operational_foundation.sql`
  - `supabase/migrations/20260319000400_phase2_booking_rules_foundation.sql`
- Confirm admin can open `/admin` and the Services tab loads without unavailable-state blockers for required tables.
- Confirm `npm run build` passes.

## Daily Merge Gate
- Treat this checklist as the required closeout gate before every daily merge.
- During controlled live use, also fill one row in the 3-day acceptance board with seed ids, evidence location, severity, and go/no-go note.
- Minimum required run:
  - Bookings filters
  - Booking detail context
  - Orders / transactions consistency
  - Customers operational view
  - Holiday scope
  - Transaction edit/save roundtrip
  - Staff scope mapping
  - Build regression
- Classify findings before merging:
  - `P0` security or data loss
  - `P1` booking logic drift
  - `P2` operational inconsistency
  - `P3` UI polish
- Do not merge a change that introduces a new `P0` or `P1` issue.

## Execution Log
Use this compact log for each merge window.

| Date | Owner | Scope | Checks run | Result | Notes / follow-up |
| --- | --- | --- | --- | --- | --- |
| 2026-03-19 | Agent 6 | Live smoke gate | bookings detail, transaction roundtrip, customer operational view, resource full, holiday enforcement | pass | Report captured in `LIVE_SMOKE_REPORT_2026-03-19.json` with seeds booking `27`, order `4`, transaction `1`, customer `3`, holiday `4`, staff `3`. |
| 2026-03-19 | Agent 6 | Build regression | `npm run build` | pass | Build completed after live smoke rerun; Next still prints the known edge-server `SIGTERM` trace after successful completion. |
| 2026-03-19 | Agent 6 | Release gate | create success/conflict, resource full, reschedule success, deterministic rollback proof, account ownership, ticket restore, admin auth | pass | `RELEASE_GATE_REPORT_2026-03-19.json`: all release-gate checks passed, including deterministic forced rollback with `rollbackVerified: true`; final decision `GO`. |

Log format:
- `Scope`: the feature area or agent slice you touched
- `Checks run`: short list of smoke items executed
- `Result`: `pass`, `pass with note`, or `fail`
- `Notes / follow-up`: one line on blockers, rollbacks, or next fix
- Rollback checks must include before/after evidence; otherwise mark `insufficient_evidence`, not `pass`.

## Controlled Live Use Evidence
For the daily bookings controlled-use lane, the generated report from `scripts/phase2-live-smoke.mjs` should always include:
- `seeds`: `location_id`, `provider_group_id`, `resource_id`, `booking_id`, `order_id`, `transaction_id`, `customer_id`, `holiday_id`, `user_ticket_id`, `staff_id`
- `controlled_booking_flow`: one chained create/reschedule/cancel lifecycle with stable request dates, slot selections, booking id, and pass/fail summary
- `controlled_booking_evidence.create`: request seed, response status/code, booking snapshot, allocation count
- `controlled_booking_evidence.reschedule`: before/after snapshots plus allocation rebuild evidence
- `controlled_booking_evidence.cancel`: before/after snapshots plus ticket restore evidence
- `checks.controlled_booking_create`, `checks.controlled_booking_reschedule`, `checks.controlled_booking_cancel`
- `evidence_checked`: a compact array of the same three lifecycle checks for easy triage

If any lifecycle step cannot be exercised because the base URL is missing, mark that step as `blocked` instead of omitting it.

## Service Relation Save Flow
- Open one service in [app/components/admin/ServicesTab.jsx](/C:/Users/Administrator/Desktop/viva/Hair-salon/app/components/admin/ServicesTab.jsx).
- Add one `location` link and save.
- Refresh `/admin`; confirm the location link still exists.
- Add one `provider group` link and save.
- Confirm only staff in that group can return slots from `/api/availability`.
- Add one `resource` link with quantity `1` and save.
- Remove a location/provider/resource link, save, refresh, and confirm no ghost relation returns.

## Availability
- Test one service with exactly one location link and no frontend location selection:
  - Expect slots to still return.
- Test one service with multiple location links and no default location:
  - Expect conservative result: empty slots with `locationSelectionRequired`.
- Add `settings.days_off` using weekday names and numbers:
  - Expect both formats to block matching dates.
- Add `holiday`, `staff_break`, `staff_time_off`, and `blocked_slot` records for the same staff/date:
  - Expect each rule to remove matching slots from `/api/availability`.
- Request `/api/availability` with `staffId` for a staff member outside the allowed provider group:
  - Expect no slots.
- Occupy a required resource via one booking:
  - Expect a second overlapping slot for the same resource-bound service to disappear.

## Booking Create
- Create a booking for a service with resources through `/api/bookings/create`.
- Confirm booking row writes normalized fields:
  - `appointment_date`
  - `start_time`
  - `end_time`
  - `buffer_end_time`
  - `location_id`
  - `provider_group_id`
- Confirm matching rows exist in `booking_resource_allocations`.
- Attempt the same staff + same slot again:
  - Expect conflict response.
- Attempt a slot where staff is free but resource is full:
  - Expect `resource_full` conflict behavior.

## Reschedule
- Reschedule an existing booking via `PATCH /api/account/bookings/[id]`.
- Confirm the booking can move within the same service without colliding with itself.
- Confirm old `booking_resource_allocations` are replaced by new allocations.
- Force allocation failure during reschedule:
  - Expect booking fields to restore to previous values.
  - Expect old allocations to be restored.

## Regression
- Confirm signup/login/account still work.
- Confirm `/account/bookings` can still cancel and reschedule.
- Confirm orders total is still server-derived.
- Confirm ticket purchase still does not grant entitlement before payment completion.
- Confirm non-admin users still cannot access `/admin`.
- Confirm bookings list filters still work after opening and closing booking detail.
- Confirm bookings detail still shows operational context after filtering by location/provider group/service.
- Edit one transaction row, save, refresh, and confirm booking/order/customer linkage still resolves.
- Confirm customer recent activity remains correctly ordered after refresh and still includes transaction context when present.
- Confirm staff scope chips still display readable location/provider-group labels after refresh.

## Known High-Risk Gaps
- Booking detail should be checked manually for provider-group and resource allocation visibility, because this slice reads operational context from joined admin props rather than a dedicated detail endpoint.
- Holidays currently expose provider-group scope in the editor, but the smoke should confirm the backing schema and save path actually persist `provider_group_id`.
- If provider-group lookup tables are unavailable, the UI should show an unavailable state rather than silently dropping the field.
- Orders and transactions are still the most likely place for stale linkage bugs, so compare one booking through all three views during smoke.

## Failure Isolation Guide
- If service config disappears after refresh:
  - Check `saveServices` in [app/admin/page.js](/C:/Users/Administrator/Desktop/viva/Hair-salon/app/admin/page.js).
- If slots look wrong before submit:
  - Check shared phase2 logic in [lib/booking/phase2.js](/C:/Users/Administrator/Desktop/viva/Hair-salon/lib/booking/phase2.js).
- If availability looks right but submit/reschedule fails:
  - Check route integration in [app/api/bookings/create/route.js](/C:/Users/Administrator/Desktop/viva/Hair-salon/app/api/bookings/create/route.js) and [app/api/account/bookings/[id]/route.js](/C:/Users/Administrator/Desktop/viva/Hair-salon/app/api/account/bookings/[id]/route.js).
