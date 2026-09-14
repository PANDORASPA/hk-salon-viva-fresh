# Booking platform launch checklist — 2026-09-14

Use this checklist for the staff-aware `appointments` platform only. Do not treat a checked box as evidence without the matching reference, timestamp, and operator initials. Never record customer names, phone numbers, email addresses, tokens, keys, complete booking references, or screenshots containing them.

## Release identity

| Field | Value |
| --- | --- |
| Candidate commit | `5dd82057d3ce14168b19686342913abe435f5a08` plus the approved release-doc commit |
| Schema source | `supabase/migrations/`, filename order |
| Local rehearsal | PGlite only; not a hosted Supabase result |
| Preview URL | ______________________________ |
| Production URL | ______________________________ |
| Release owner / time | ______________________________ |

## Hard go / no-go gates

Do not deploy or open booking if any item below is incomplete or failed.

- [ ] Current committed code has a passing `npm run test:unit` result.
- [ ] Current committed code has a passing `npm run security:scan` result.
- [ ] Current committed code has a passing `npm run build` result.
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
- [ ] Decide notification mode using `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_PROVIDER`, `NOTIFY_DRY_RUN`, and `NOTIFY_WHATSAPP_PROVIDER`; test the stored outcome, not just a UI message.
- [ ] If self-service packages are enabled, set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_CURRENCY`; otherwise keep the purchase path honestly disabled.
- [ ] Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` if shared multi-instance rate limiting is required.
- [ ] Enter only approved contact content. Confirm missing phone, WhatsApp, email, Instagram, address, and address-note fields remain hidden rather than substituted.

## Migration and security evidence

Before a hosted migration, create/confirm a recoverable database backup and record its dashboard timestamp or job identifier here: ______________________________.

On a clone or isolated project first, apply every file from `supabase/migrations/` in ascending filename order. Record the final migration name: ______________________________. Run the overlap query in the operations manual before release and require zero rows. Then record:

| Check | Isolated / clone evidence | Production evidence |
| --- | --- | --- |
| Migration order and completion | ____________________ | ____________________ |
| Overlap preflight returns zero rows | ____________________ | ____________________ |
| `appointments_staff_occupied_excl` exists | ____________________ | ____________________ |
| RLS: customer A cannot read customer B | ____________________ | ____________________ |
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
