# Task 6 — Customer identity binding

Status: implemented and verified locally. No hosted database or deployment was changed.

## Delivered

- CLI-created `20260914115538_customer_identity_binding.sql` adds nullable unique `customers.user_id uuid references auth.users(id)`.
- Customers and customer packages have explicit grants and owner-only RLS. Customer UPDATE includes both USING and WITH CHECK. Browser roles cannot insert customers, change ownership, delete customers, or modify package balances. Customers may update only name/phone/email. Admin operations continue through the existing authenticated, audited service-client routes; the old broad browser admin policies on these two tables are removed.
- The legacy public phone-lookup policy is removed. `/api/customers` always returns 410 `endpoint_removed`, with no database lookup. `/api/customers/me` returns 401 `authentication_required` for signed-out, invalid-auth, and anonymous-auth contexts; successful responses contain only the caller's safe customer profile and usable packages, with `private, no-store` and `Vary: Cookie`.
- `resolveAuthenticatedCustomer(serverClient, serviceClient)` calls server Auth `getUser()` and resolves only by `customers.user_id = verified user.id`. Browser customer IDs, phone matches, email matches and user_metadata never authorize ownership.
- First access uses conflict-ignore upsert keyed exclusively by user_id, then rereads by that ID. Concurrent first requests converge without overwriting profile changes. Only confirmed Auth email/phone are copied. Missing display names use the neutral `Customer` label. Customer phone now permits NULL; phone uniqueness remains. A verified phone held by a legacy row triggers a NULL-phone retry, never a legacy-row link.
- The appointment route's default resolver now supplies `{ customer, actorUserId }`. Submitted customerId/actorUserId cannot replace it. Guests remain self-pay; package use requires the linked customer and existing transactional SQL ownership checks. An email-only account may supply a booking phone; it is stored on that appointment without changing or establishing customer ownership.
- Account package loading now uses the linked numeric customer ID, replacing the incorrect comparison against an Auth UUID and the nonexistent customer-package `created_at` sort. Account and `/me` use the same usable-package query.

## Commands and evidence

- Read Supabase skill and current Auth/RLS documentation; read installed Next.js route-handler documentation required by AGENTS.md.
- `npx supabase migration new --help` and `npx supabase --version`: CLI 2.117.0.
- `npx supabase migration new customer_identity_binding`: created `supabase/migrations/20260914115538_customer_identity_binding.sql`.
- RED: `node --test tests/customer-identity.test.mjs`: 0/5 passed. The real PostgreSQL anonymous SELECT unexpectedly succeeded; remaining assertions reported the missing auth-bound implementation.
- Initial GREEN: `node --test tests/customer-identity.test.mjs tests/schema-security.test.mjs`: 9/9 passed.
- Strengthened identity verification: `node --test tests/customer-identity.test.mjs`: 6/6 passed, adding independent RLS reassignment/legacy-claim checks, inactive-catalogue filtering and email-only booking contact checks.
- Final focused verification: `node --test tests/customer-identity.test.mjs tests/schema-security.test.mjs`: 10/10 passed, exit 0 (23.6 seconds).
- First `npm run test:unit`: 184/185 passed. The older baseline guest route fixture lacked auth injection after enabling the default resolver. Updated that fixture with signed-out server Auth, without weakening its canonical appointment/RPC assertions.
- Final `npm run test:unit`: 186/186 passed, exit 0 (67.1 seconds). Existing Task 5 full-chain migration/RPC, collision, concurrency, rollback, package ownership, reschedule and cancellation tests remain intact. Two Task 5 factory tests now explicitly inject their guest context.
- `npm run build`: exit 0; `/api/customers/me` and `/account` included in the Next.js route output. Existing warnings remain for optional missing `resend`/`stripe` packages and custom static Cache-Control configuration. Existing Node module-type warnings occur in the unit suite.
- `git diff --check`: exit 0, no whitespace defects.
- `npx supabase db advisors --local --type security` and `npx supabase migration list --local`: could not connect to 127.0.0.1:54322 (`ECONNREFUSED`). No local Supabase database service is running. These are environment limitations, not successful advisory/migration-history results.

## Executable security proof

The suite uses the existing `bookingDatabase` harness to replay every application migration unmodified in filename order in PGlite's PostgreSQL engine. Only Supabase-owned Auth/Storage infrastructure is stubbed. The new query transport forwards the production resolver/HTTP handler's filters and writes into that database; the appointment route calls the real migrated SQL RPCs. Auth `getUser()` is the external boundary fixture. No source-grep assertions are used as the primary security proof.

- Anonymous customer and package reads return PostgreSQL 42501.
- An authenticated owner sees exactly its own customer and packages; another customer's update affects zero rows.
- Own permitted profile updates succeed. Ownership changes, clearing user_id, customer insertion and package-balance changes fail.
- With a deliberately widened UPDATE(user_id) grant only in an isolated test, RLS itself still rejects reassignment and clearing ownership; attempts to claim an unlinked legacy row affect zero rows. An admin Auth identity with no owned customer does not gain browser access to all customers.
- Duplicate user bindings fail with 23505; unknown Auth IDs fail with 23503.
- Verified phone/email collisions never claim legacy records; concurrent first accesses return the same new owned customer. Unconfirmed contact details and metadata names/IDs are not imported.
- `/me` ignores supplied phone/customerId query parameters, omits private notes/user_id, excludes other owners' packages, and filters exhausted, expired, inactive-assignment and inactive-catalogue packages.
- Through the actual appointment handler/resolver/SQL chain: anonymous package request returns 401, another owner returns 403, owner booking returns 201 and consumes exactly one session, guest self-pay returns 201 with no customer binding, and an email-only account retains its verified user/customer binding despite submitted contact/identity fields.

## Files

- `supabase/migrations/20260914115538_customer_identity_binding.sql`
- `lib/customers/identity.js`
- `lib/customers/http.js`
- `app/api/customers/me/route.js`
- `app/api/customers/route.js`
- `app/api/appointments/route.js`
- `app/account/page.js`
- `tests/customer-identity.test.mjs`
- `tests/helpers/customer-client.mjs`
- `tests/booking-commands.test.mjs` (guest fixture adaptation only)
- `tests/booking-platform-baseline.test.mjs` (signed-out auth fixture)
- This report.

## Self-review and remaining integration concerns

Reviewed all new grants, policies, resolver queries, public projections and the appointment identity handoff. There is no new SECURITY DEFINER function and no frontend service-key path. Both update policy predicates and column restrictions protect ownership. Read failures propagate to sanitized 500 responses instead of silently returning unrelated/fallback customers. Historical migrations and the Task 5 database harness were not modified.

The neutral customer name can be changed through the owned customer profile contract; the existing separate profiles UI does not synchronize the new customer record. The booking phone fallback is a contact detail only, never a binding source.

The existing booking form still calls the retired phone endpoint; its planned Task 8 replacement must consume `/api/customers/me`. It receives no customer data from the retired route. Legacy unlinked customer/package records remain unlinked and require a later audited admin reconciliation/link; an automatically created owned row may need reconciliation with that legacy record. This task intentionally supplies no unaudited link operation.

Hosted Auth/PostgREST integration and Supabase advisors/migration-history checks still need the target deployment environment. The local tests execute PostgreSQL ownership, grants and command semantics, but do not claim a running hosted Auth/PostgREST service or a completed live migration.

## Current documentation consulted

- [Supabase changelog index](https://supabase.com/changelog.md), including the [explicit Data API grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
- [Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser): server verification is performed by the Auth service.
- [Row level security](https://supabase.com/docs/guides/database/postgres/row-level-security): grants and policies, ownership predicates, and UPDATE SELECT/USING/WITH CHECK requirements.
- [Server-side Next.js client](https://supabase.com/docs/guides/auth/server-side/nextjs).
