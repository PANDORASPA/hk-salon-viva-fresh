# Task 3 report: pure staff-aware availability rules

## Result

Implemented the pure, injected-clock availability rules in:

- `lib/booking/rules.js`
- `lib/booking/availability-v2.js`
- `tests/availability-v2.test.mjs`

The implementation uses Asia/Hong_Kong fixed-offset arithmetic and emits explicit `+08:00` ISO values. Occupancy is half-open, with active appointment statuses `pending`, `confirmed`, and `completed`; cancelled and no-show rows do not block. Defaults are 30-minute step, 15-minute buffer, 120-minute minimum lead, and 90-day maximum advance.

## TDD evidence

### RED

Command:

```text
node --test tests/availability-v2.test.mjs
```

Result: failed before production modules existed with `ERR_MODULE_NOT_FOUND` for `lib/booking/rules.js` (expected missing-feature failure).

### GREEN

Command:

```text
node --test tests/availability-v2.test.mjs
```

Result: 4 tests passed, 0 failed, 0 skipped.

Focused test coverage includes overlap and buffer removal, time-off, closed/business hours, unskilled and inactive staff, any-staff union, blocked dates, service duration, single-day cross-midnight rejection, lead-time boundaries, and horizon boundaries.

## Full verification

Command:

```text
npm test
```

Result: 127 tests passed, 0 failed, 0 skipped.

The repository prints existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for its mixed module setup; no new test or runtime errors occurred.

## Self-review and concerns

- Pure functions do not access a database, browser, environment clock, or global `new Date()` for current time; callers provide `now`.
- Canonical row names and aliases are accepted for service duration, staff skill IDs, weekly hours, time-off, appointments, and business hours.
- Candidate intervals include service duration plus buffer and use half-open overlap comparisons, so exact boundary adjacency remains available.
- Single-day service behavior is enforced by requiring the complete duration plus buffer to fit within the intersected same-day shop/staff window; no next-day slot is emitted.
- A future refinement could add a project-wide `type: module` declaration to remove existing Node warnings, but it is outside this task and could affect legacy imports.

## Fix Round 1

Addressed review findings:

- Staff without an explicit service mapping are now unqualified (including empty mappings).
- `buildStaffAvailability` now requires a valid injected `now`; invalid/missing clocks deterministically return `{ slots: [], staffAvailability }` with no slots. `validateBookingWindow` already returns `{ ok: false, code: 'booking_window_invalid' }` for the same condition.
- Added real behavior coverage for all active appointment statuses, cancelled/no-show behavior, buffer and time-off boundary adjacency, defaults, absent mappings, invalid clocks, and build-time lead/horizon filtering.

### Fix-round RED

Command:

```text
node --test tests/availability-v2.test.mjs
```

Result: 16 tests ran, 13 passed and 3 failed. The failures captured the two production regressions (absent mapping qualified staff; invalid availability clock admitted slots) plus one hand-derived default expectation that was corrected to the actual 30-minute-step/15-minute-buffer boundary.

### Fix-round GREEN

Commands:

```text
node --test tests/availability-v2.test.mjs
npm run test:unit
```

Results: focused suite 16 passed, 0 failed; full unit suite 139 passed, 0 failed, 0 skipped.

Commit: `fix: harden availability qualification and clock handling`.
