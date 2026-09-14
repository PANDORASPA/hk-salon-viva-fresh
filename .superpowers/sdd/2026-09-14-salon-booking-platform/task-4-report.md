# Task 4 Report — Safe Staff and Availability APIs

## Outcome

Implemented the public `GET /api/staff` endpoint and upgraded `GET /api/availability` to use the staff-aware availability engine. The route handlers use injectable factories; Supabase loading, parallel query orchestration, field selection, and sanitization live in `lib/booking/load-availability.js`. The existing availability dependency setter remains only for the unchanged Task 1 runtime-boundary test.

## RED evidence

### Initial feature RED

```text
node --test tests/availability-api-v2.test.mjs
```

Result: exit 1; 13 tests ran, 0 passed, 13 failed. Failures were the expected missing `errors.js`, `load-availability.js`, and staff route modules plus the absent `createAvailabilityHandler` export.

### Public-service privacy RED

```text
node --test tests/availability-api-v2.test.mjs
```

Result after the first implementation: exit 1; 14 tests ran, 13 passed, 1 failed. The failing test proved that using a service-role client without rechecking `services.enabled` and `services.published` would reveal staff assignments for an unpublished service.

### Preserved Task 1 boundary RED

```text
node --test tests/booking-platform-baseline.test.mjs
```

Result after the first implementation: exit 1; 2 tests ran, 1 passed, 1 failed. The existing query-chain double exposed an accidental incompatibility with newer `.order()`, `.in()`, and `.gt()` methods. The loader now keeps full Supabase behavior when those methods exist and preserves the older executable boundary through safe fallbacks and deterministic in-memory ordering.

## GREEN and verification evidence

```text
node --test tests/availability-api-v2.test.mjs tests/booking-platform-baseline.test.mjs
```

Result: exit 0; 16 passed, 0 failed. This includes the new API behavior and unchanged Task 1 runtime boundary.

```text
node --test tests/availability-api-v2.test.mjs tests/availability-v2.test.mjs
```

Result: exit 0; 37 passed, 0 failed.

```text
npm run test:unit
```

Result: exit 0; 160 passed, 0 failed, 0 skipped.

```text
npm run build
```

Result: exit 0; Next.js 16.3.4 compiled successfully, completed type checking/page generation, and registered both `/api/availability` and `/api/staff`. Existing unrelated warnings remain for optional `resend`/`stripe` imports and custom static Cache-Control headers.

```text
git diff --check
node --check app/api/availability/route.js
node --check app/api/staff/route.js
node --check lib/booking/errors.js
node --check lib/booking/load-availability.js
```

Result: all exited 0. Git emitted only the repository's line-ending notice for the modified availability route.

## Privacy and stable-error coverage

- Public staff responses contain exactly `id`, `displayName`, `bio`, and `colourHex`.
- Private staff `name`, timestamps, `sort_order`, activity flags, and service-link internals never enter the response.
- Unpublished or disabled service IDs return an empty staff list even though the server uses a service-role client.
- Time-off queries select only `staff_id`, `starts_at`, and `ends_at`; the private `reason`, creator, and timestamps are neither loaded nor returned.
- Appointment queries select only occupancy fields; customer identity/contact fields are neither loaded nor returned.
- Missing `staffId` is `any`; exact `any` and positive safe integers are accepted. Zero, negatives, fractions, arbitrary text, and padded/case-altered variants return the stable 400 `validation_error` without opening a database client.
- A numeric staff preference changes the computed slot set, rather than merely being echoed.
- Supabase query details are retained in injected server logs, while the public response is the stable 503 `availability_unavailable` payload without database codes/messages/hints.
- `slot_unavailable` maps to the required stable 409 Traditional Chinese response.

## Files

- Modified `app/api/availability/route.js`
- Added `app/api/staff/route.js`
- Added `lib/booking/load-availability.js`
- Added `lib/booking/errors.js`
- Added `tests/availability-api-v2.test.mjs`
- Added this report

## Self-review

- All nine required availability sources start inside one `Promise.all`: service, staff, staff-service links, weekly hours, time off, appointments, business hours, blocked dates, and settings.
- Query projections are allowlists; public payloads are reconstructed from allowlisted values instead of forwarding Supabase rows.
- Route factories keep executable tests isolated. No new mutable dependency setter was introduced; the pre-existing availability setter is retained solely for Task 1 compatibility.
- Dates are calendar-validated before data access, database windows use Hong Kong midnight boundaries, and the existing pure availability engine receives an injected clock.
- Current Supabase documentation confirms filters follow `select()` and fluent queries can be composed before awaiting. The changelog's April 2026 Data API exposure change does not alter this server-only loader; the existing migration already enables RLS and declares explicit grants.

## Concerns

- The repository has pre-existing Node `MODULE_TYPELESS_PACKAGE_JSON` test warnings and build warnings for optional `resend`/`stripe` packages and custom Cache-Control headers. They are outside Task 4 and did not affect exit status.
- `app_settings` currently stores legacy `booking_buffer_minutes`; the loader also accepts the planned snake/camel-case step, lead-time, and horizon keys so the availability engine retains its documented defaults until those settings are present.

## Fix Round 1 — Midnight-spanning appointment occupancy

### Root cause

The appointment query constrained `starts_at >=` the requested Hong Kong day start. The database occupancy range can begin before midnight and end after it, so that filter removed a row before `buildStaffAvailability` could evaluate its `occupied_until`. This allowed an overlapping midnight slot to appear available.

The controlled Supabase query double previously compared timestamp text lexically. It now parses timestamp operands and compares instants, matching PostgreSQL `timestamptz` behavior while leaving dates and clock-only strings on their natural comparison path.

### RED

```text
node --test tests/availability-api-v2.test.mjs
```

Result: exit 1; 15 tests ran, 14 passed and the new route regression failed. Actual labels were `['00:00', '00:30', '01:00', '01:30']`; the hand-derived safe result excluded the overlapping `00:00` slot.

Mutation caught: restoring `starts_at >= window.start` (or omitting the `occupied_until > window.start` intersection bound) makes the regression fail by admitting `00:00`.

### GREEN

The appointment query now loads active occupancy intersecting the requested day using the half-open conditions `starts_at < window.end` and `occupied_until > window.start`. Its safe projection remains `staff_id,starts_at,occupied_until,status`.

```text
node --test tests/availability-api-v2.test.mjs
```

Result: exit 0; 15 passed, 0 failed.

```text
node --test tests/availability-api-v2.test.mjs tests/booking-platform-baseline.test.mjs
```

Result: exit 0; 17 passed, 0 failed.

```text
npm run test:unit
```

Result: exit 0; 161 passed, 0 failed, 0 skipped. Pre-existing module-type warnings remain unchanged.
