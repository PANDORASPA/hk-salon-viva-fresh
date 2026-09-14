# Architecture — SALON POKE BY VIVA

The current platform uses Next.js 16 App Router, React 18 and Supabase PostgreSQL/Auth/Storage. All booking decisions use Asia/Hong_Kong; stored timestamps are UTC. The [design](superpowers/specs/2026-09-14-salon-booking-platform-design.md), [operations runbook](booking-platform-operations.md) and [migration inventory](supabase-setup-order.md) supersede earlier platform diagrams.

## Booking and identity boundaries

`appointments` is the booking source of truth. Every create/reschedule/cancel passes through server-only atomic SQL commands. They check service/staff eligibility, shop/staff hours, closure dates, time off, lead/horizon, slot grid and entitlement, then enforce per-staff occupied-range exclusion. The saved buffer is 0–120 minutes (default 15).

`customers.user_id` uniquely binds a customer to verified Supabase Auth. Phone/email matching and browser-provided IDs never prove ownership. Account contact edits read/write canonical `customers`; `profiles` remains only a legacy bootstrap source. The wizard prefills canonical contacts; reviewed name/phone/email become the appointment's intentional snapshot, not an implicit change to profile defaults.

Browser roles cannot directly mutate appointments, including browser administrators. Owner reads have RLS plus explicit safe column grants; admin notes, token hashes and internal ownership metadata are not granted. Account PATCH/DELETE check strict ownership before any command; administrators use separate audited admin commands.

Guest confirmation requires the random 256-bit capability token; only its SHA-256 hash is stored. Owner confirmation relies on the authenticated owner RLS path. Confirmation exposes a safe service/staff and redeemed/refunded payment summary, never internal fields.

## Packages and payments

`packages` and `package_services` define the catalogue and eligible services. `customer_packages` holds ownership-bound entitlements; `package_redemptions` retains one redemption per appointment and its refund timestamp. The booking transaction redeems a session or rolls back entirely; cancellation refunds once. Client filtering is advisory; SQL is authoritative.

Manual issuance uses a reasoned, ownership-bound admin command and a unique request key in `admin_package_issuances`. Retrying the same command returns the same entitlement and audit rather than duplicating a package. Exact namespaced E2E cleanup removes issuance keys before their entitlement parents.

Stripe is hard-disabled even if keys and SDK are present. Checkout POST and webhook return `503 payments_unavailable`; no legacy `user_tickets` writes exist. Online sales require a separately reviewed canonical fulfillment implementation. Standalone legacy redemption/refund helpers return `operation_retired` without database access.

## Administration and audit

Admin routes verify the active `admin_users` actor, origin/rate guard and strict input shape. Server-only RPCs store mutations and durable before/after audit in one transaction; a failed audit rolls the mutation back. This covers booking commands, staff/mappings/hours/time off, customer create/edit, package issuance/balance/state, service publishing, catalogue packages, shop hours/closures, site content/settings and administrator state. The last active administrator and staff future-appointment invariants remain enforced by SQL.

The unused best-effort `lib/admin-audit.js` helper was removed. The remaining export-read audit helper throws persistence errors. Legacy customer/service imports, unaudited delete/GDPR-delete and package-service mutation routes return guarded admin-only `410`; they do not pretend erasure happened.

Gallery metadata and audits are transactional; object-storage bytes are not. Upload failure attempts exact cleanup, and delete cleanup failure is surfaced to the operator without claiming success for storage removal.

## Notifications and operational safety

Committed bookings survive notification failure. Notification outcomes persist in a browser-denied table; the dashboard presents safe per-channel follow-up guidance. Reminder leases/idempotency remain authoritative in SQL. Repeated sequential cancellations skip a second notification; exactly-once external delivery under concurrent requests is not claimed.

Live Resend requires its optional SDK, approved configuration and an authorised smoke. WhatsApp delivery is not implemented; configured provider names do not constitute delivery proof. Dry-run settings and persisted results must be checked explicitly.

All-week emergency closure uses the audited scheduling command and stops new bookings without deleting existing appointments.

## Verification

Unit/behavior tests use Node's runner. The role/command suites replay all application migrations in disposable PGlite with real PostgreSQL constraints/functions and `SET ROLE` probes; Supabase-owned Auth/Storage infrastructure is minimally stubbed. Controller tests exercise delayed responses and mutation reentry. Playwright cases and guarded isolated provisioning are checked in.

Local rehearsal is not hosted Supabase/Data API/Storage/advisor proof, a real multi-connection concurrency test, or live browser E2E proof. Run the full local gates and record separate isolated, preview and production evidence before launch. No historical live-schema or Bristol document establishes current launch readiness.
