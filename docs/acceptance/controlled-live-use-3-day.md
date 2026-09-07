# Controlled Live Use Acceptance Board

Scope: Stage 2B / 3A release gate for create, reschedule, auth, and admin operational views.

## Gate Summary
- **GO**: all Day 1-3 checks pass, each required evidence artifact is present, and no `P0`/`P1` findings remain open.
- **Conditional GO**: one `P2` or `P3` issue remains, but it is documented with clear owner, rollback path, and no data-loss risk.
- **NO-GO**: any `P0`/`P1` issue, missing rollback proof, missing auth proof, or missing refresh proof on scoped records.

## Required Evidence Fields
- `seed_id`
- `seed_type`
- `seed_source`
- `evidence_type`
- `evidence_location`
- `expected_result`
- `actual_result`
- `severity`
- `decision`

## Day 1: Create / Auth / Scope Seeds
| Check | Seed | Evidence | Severity | Pass criteria | Go / No-Go note |
| --- | --- | --- | --- | --- | --- |
| Admin auth | One admin account, one non-admin account | Screenshot or note of `/admin` access result for both accounts | `P0` if non-admin enters admin; else `P1` | Admin can enter `/admin`, non-admin is blocked | Block release if non-admin reaches admin |
| Service relation save | One service with one location, one provider group, one resource | DB row proof after save + admin refresh screenshot | `P1` if relations do not persist | Relation rows survive refresh and deleted rows do not return | No GO unless refresh proves persistence |
| Holiday scope | One provider-group-scoped holiday, one location-scoped holiday | Holiday row screenshot + `/api/availability` result | `P1` if scope is ignored | Holiday only blocks intended scope | No GO if provider-group scope is ignored |
| Booking create seed | One service with resource capacity `1` | Created booking row + `booking_resource_allocations` row | `P1` if allocation missing | Booking writes normalized fields and allocation row exists | Block if create writes booking without allocation |

## Day 2: Availability / Conflict Seeds
| Check | Seed | Evidence | Severity | Pass criteria | Go / No-Go note |
| --- | --- | --- | --- | --- | --- |
| Provider mismatch | Staff outside allowed provider group | `/api/availability` response + admin slot view | `P1` if slot still appears | No slot returned | Block if staff is still bookable |
| Resource full | One occupied required resource, same slot retry | Response payload or screenshot showing conflict | `P1` if second slot remains visible | Slot disappears or returns `resource_full` conflict | No GO if resource capacity is ignored |
| Multiple locations, no picker | Service with 2 locations and no frontend selection | Availability response with `locationSelectionRequired` | `P2` if behavior is unclear; `P1` if fake slot appears | Conservative empty result | Conditional GO only if behavior is explicit |
| Staff schedule block | Seed `holiday`, `break`, `time off`, `blocked slot` on same day | Availability response + row screenshots | `P1` if any rule fails to block | Matching slots disappear | Block release if any rule is bypassed |

## Day 3: Reschedule / Records / Rollback Seeds
| Check | Seed | Evidence | Severity | Pass criteria | Go / No-Go note |
| --- | --- | --- | --- | --- | --- |
| Reschedule success | One existing booking with resources | Before/after booking row + new allocation row | `P1` if allocations do not move | Booking updates and old allocations are replaced | No GO if reschedule uses stale allocations |
| Forced rollback | Same booking, deterministic allocation failure after booking update | Before/after booking row, allocation rows, and failure log | `P0` if partial write remains | Booking restores previous values and old allocations return | This is the hard gate for GO |
| Transaction edit roundtrip | One transaction linked to the booking | Before/after refresh screenshot + linkage proof | `P2` if linkage display drifts | Booking/order/customer linkage remains readable after save | Conditional GO if only display drift remains |
| Customer ops view | One customer with booking, order, transaction, ticket | Recent activity screenshot before/after refresh | `P2` if ordering or counts drift | Recent activity remains stable and useful | Do not GO if ops history becomes stale |

## Minimum Release Evidence Package
- One saved service relation refresh proof.
- One provider-group holiday enforcement proof.
- One create flow with resource allocation proof.
- One resource-full conflict proof.
- One reschedule success proof.
- One forced rollback proof with restored booking and restored allocations.
- One admin auth denial proof for a non-admin user.
- One transaction edit/refresh proof.

## Final Call Rules
- Issue **GO** only if all required evidence is present and every `P0`/`P1` item passes.
- Issue **Conditional GO** only if remaining findings are `P2` or lower, are documented, and do not affect create/reschedule/auth correctness.
- Issue **NO-GO** if any rollback, auth, provider-group scope, or allocation integrity evidence is missing or fails.
