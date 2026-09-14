# Booking platform launch checklist — 2026-09-14

Use this checklist for the staff-aware `appointments` platform only. Do not treat a checked box as evidence without the matching reference, timestamp, and operator initials. Never record customer names, phone numbers, email addresses, tokens, keys, complete booking references, or screenshots containing them.

## Release identity

| Field | Value |
| --- | --- |
| Candidate commit | The clean release checkout: capture `git rev-parse HEAD` with the gate output; never reuse an earlier implementation hash |
| Schema source | All files from `supabase/migrations/`, filename order; final version `20260915050000_final_release_integrity.sql` |
| Local rehearsal | PGlite only; not a hosted Supabase result |
| Preview URL | ______________________________ |
| Production URL | ______________________________ |
| Release owner / time | ______________________________ |

## Hard go / no-go gates

Do not deploy or open booking if any item below is incomplete or failed.

- [ ] Current committed code has a passing `npm run test:unit` result.
- [ ] Current committed code has a passing `npm run security:scan` result.
- [ ] Current committed code has a passing `npm run build` result.
- [ ] If live Resend is required, install its optional SDK and pass an authorised delivery smoke; it is currently absent.
- [ ] Stripe remains hard-disabled. Installing its SDK or configuring keys does not enable payment. Do not launch online package sales until canonical ownership-bound `customer_packages` fulfillment, verified webhook events, idempotency/reconciliation and payment/refund smokes are implemented and reviewed.
- [ ] `git diff --check` is clean and no tracked secret or local E2E runtime file exists.
- [ ] The isolated E2E suite passes after its own guarded provisioning. A missing E2E credential is a blocker, not a pass.
- [ ] A hosted Supabase clone/isolated project has migration, RLS, atomic-booking, and concurrency evidence.
- [ ] A preview smoke has recorded results for every row below.
- [ ] A production backup is confirmed before migration, and production smoke is recorded after migration and deployment.
- [ ] First active administrator, real staff-service mappings, weekly hours, rest/time-off, and notification decision are checked by an authorised operator.

Any P0 security/data-loss result or P1 booking-integrity result is an immediate no-go: stop new booking availability, retain existing `appointments`, restore the last good application deployment, and use a new forward-only migration for database repair.

## Pre-release configuration

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for the target project.
- [ ] Set server-only `SUPABASE_SERVICE_ROLE_KEY`; verify it is absent from browser bundles and public environment names.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the exact target origin and add its `/auth/callback` URL in Supabase Auth redirects.
- [ ] Set `CRON_SECRET`; configure `/api/cron/reminders` to use the Authorization bearer header.
- [ ] Decide notification mode using `app_settings.notify_email_enabled`, `app_settings.notify_dry_run`, `NOTIFY_DRY_RUN`, `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, and `NOTIFY_WHATSAPP_PROVIDER`; an unset `NOTIFY_DRY_RUN` defers to saved `notify_dry_run`, `1` forces dry-run, and `0` forces live delivery. `0` can send when the email channel, Resend configuration, and SDK are enabled. Test the stored outcome, not just a UI message.
- [ ] Keep online purchase controls disabled. Checkout POST and webhook return `503 payments_unavailable`; checkout GET redirects to the disabled packages page. No webhook writes to legacy `user_tickets`. Store any future Stripe keys server-side only after a separately reviewed fulfillment implementation.
- [ ] Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` if shared multi-instance rate limiting is required.
- [ ] Enter only approved contact content. Confirm missing phone, WhatsApp, email, Instagram, address, and address-note fields remain hidden rather than substituted.

## Migration and security evidence

Before a hosted migration, create/confirm a recoverable database backup and record its dashboard timestamp or job identifier here: ______________________________.

On a clone or isolated project first, apply every file from `supabase/migrations/` in ascending filename order. The current final migration is `20260915050000_final_release_integrity.sql`. Generate the complete ordered list using the command in [setup order](supabase-setup-order.md); record its output with the candidate commit. Run the overlap query in the operations manual before release and require zero rows. Then record:

| Check | Isolated / clone evidence | Production evidence |
| --- | --- | --- |
| Migration order and completion | ____________________ | ____________________ |
| Hosted database advisors are reviewed with no launch-blocking findings | ____________________ | ____________________ |
| Overlap preflight returns zero rows | ____________________ | ____________________ |
| `appointments_staff_occupied_excl` exists | ____________________ | ____________________ |
| RLS: customer A cannot read customer B; owner cannot select appointment internal fields or mutate appointments directly | ____________________ | ____________________ |
| RLS: non-admin cannot call admin mutation | ____________________ | ____________________ |
| Notification rows deny browser read/write | ____________________ | ____________________ |
| Atomic package redemption/refund verified | ____________________ | ____________________ |
| Deliberate collision gives one success and one conflict | ____________________ | ____________________ |

## Preview and production smoke matrix

Use disposable accounts and sanitized references only. Do not run a production create/cancel/reschedule smoke without an authorised test window and cleanup plan.

| Flow | Preview HTTP/result evidence | Production HTTP/result evidence |
| --- | --- | --- |
| `/` and `/services` render | ____________________ | ____________________ |
| `/booking` shows availability for specified staff and any staff | ____________________ | ____________________ |
| Guest self-pay create and confirmation | ____________________ | ____________________ |
| `/signin`, `/account`, owner-only confirmation and calendar download | ____________________ | ____________________ |
| Owner reschedule, cancel, and one-time package refund | ____________________ | ____________________ |
| Concurrent same-staff collision (one accepted, one conflict) | ____________________ | ____________________ |
| `/admin/login` and authenticated `/admin` | ____________________ | ____________________ |
| Admin staff mapping, weekly hours, rest/time-off change availability | ____________________ | ____________________ |
| Admin create/reschedule/status action has audit record | ____________________ | ____________________ |
| Admin customer create/edit, ownership-bound idempotent package issuance, publish/active toggles, closures and complete contact content commit before/after audits | ____________________ | ____________________ |
| Admin emergency all-week closure rejects new public submissions and preserves existing bookings | ____________________ | ____________________ |
| Canonical profile edit prefills booking; package confirmation says redeemed, self-pay says onsite | ____________________ | ____________________ |
| Retired customer/service imports, destructive deletes and GDPR deletion return guarded `410` without mutation | ____________________ | ____________________ |
| Cron denies unauthorised request and records authorised notification outcome | ____________________ | ____________________ |
| Mobile and desktop booking/admin usability | ____________________ | ____________________ |

## Decision

| Gate | Result | Operator / timestamp |
| --- | --- | --- |
| Local gates | ☐ pass / ☐ fail | ____________________ |
| Isolated E2E | ☐ pass / ☐ fail | ____________________ |
| Hosted migration rehearsal | ☐ pass / ☐ fail | ____________________ |
| Preview smoke | ☐ pass / ☐ fail | ____________________ |
| Production backup + migration | ☐ pass / ☐ fail | ____________________ |
| Production smoke | ☐ pass / ☐ fail | ____________________ |
| Final decision | ☐ GO / ☐ NO-GO | ____________________ |

No-go reason and follow-up owner: ______________________________.
