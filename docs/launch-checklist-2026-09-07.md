# Production launch checklist — SALON POKE BY VIVA

> **Target URL:** https://hk-salon-viva-fresh.vercel.app  
> **Supabase:** project `khjjvjufwbmqymgzhbkl` (eu-west-3)  
> **Repository:** https://github.com/PANDORASPA/hk-salon-viva-fresh  
> **Last code freeze:** 2026-09-07 (commit `6486c17` on master)

This checklist is what an operator should walk through before opening the
site to real customers. Each item is binary (done / not done) and points
at the file or setting that proves it.

## A. Server-side prerequisites (run once per environment)

| # | Item | Where | Status |
|---|------|-------|--------|
| A1 | `.env.local` (Vercel project settings) has `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_SERVICE_ROLE_KEY` set to **production** values | Vercel → Project → Settings → Environment Variables | ☐ |
| A2 | `NEXT_PUBLIC_SITE_URL` set to the production domain (used for absolute WhatsApp + .ics links) | Vercel env | ☐ |
| A3 | All 5 canonical Supabase migrations applied, in filename order, to the live project | Supabase → SQL editor → `supabase/migrations/*.sql` | ☐ |
| A4 | `npm install resend` in this repo so live email sending is available (optional — dry-run otherwise) | local + add `resend` to `package.json` dependencies | ☐ |
| A5 | `RESEND_API_KEY` + `NOTIFY_EMAIL_FROM` set in Vercel env (only if you want live emails; otherwise dry-run persists) | Vercel env | ☐ |
| A6 | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `STRIPE_CURRENCY=HKD` set if self-service `/packages` is enabled | Vercel env | ☐ |
| A7 | `CRON_SECRET` set to a long random string; configure the same value in the Vercel cron job that hits `/api/cron/reminders` (vercel.json already declares the schedule) | Vercel env + cron UI | ☐ |
| A8 | `CANCEL_CUTOFF_HOURS=24` (or whatever value fits policy) | Vercel env | ☐ |
| A9 | Supabase Auth redirect URLs allowlist includes `https://hk-salon-viva-fresh.vercel.app/auth/callback` | Supabase → Auth → URL config | ☐ |
| A10 | Supabase Storage bucket `salon-gallery` exists, gallery images uploaded | Supabase → Storage | ☐ |

## B. Smoke flow before opening

| # | Item | How to verify | Pass? |
|---|------|---------------|-------|
| B1 | Home renders with the language switcher visible | Visit `/` | ☐ |
| B2 | Language switch flips `<html lang>` and re-renders the page | Toggle en / zh-HK, watch HTML attribute | ☐ |
| B3 | `/services`, `/packages`, `/about`, `/contact`, `/gallery`, `/location`, `/privacy`, `/terms` all 200 | curl each, check `<h1>` matches | ☐ |
| B4 | `/booking` phone lookup finds an existing test customer (use a phone that was previously imported) | Enter phone, observe customer_found chip | ☐ |
| B5 | Booking submit (no package) writes a `bookings` row, fires a `booking_confirmation` notification (console-log or Supabase row) | Submit form, then `select * from notifications order by delivered_at desc limit 1;` | ☐ |
| B6 | Booking submit (with package) decrements `customer_packages.sessions_remaining` and writes a `package_redemptions` row | Check both tables after booking | ☐ |
| B7 | `/booking/confirm?id=N` shows the booking summary with the WhatsApp CTA + .ics link | Visit the redirect URL | ☐ |
| B8 | `/packages` (mock mode) creates a session and redirects to `/packages/success?session_id=...`; Supabase gets a `user_tickets` row | Open /packages, click Buy, check Supabase | ☐ |
| B9 | `/signin` form signs in an existing member; `?message=session_expired` shows the right notice | Sign in with a real member; visit /account directly after sign-out | ☐ |
| B10 | `/account` shows the right packages + bookings; cancel + reschedule work for a >24h booking | Sign in, open account, click 取消/改期 | ☐ |
| B11 | Cancel within 24h returns the `late_cancellation` 400 and the client shows the friendly message | Create a booking for tomorrow, attempt to cancel | ☐ |
| B12 | `/admin/login` signs in an admin; the 9 admin tabs all load data | Sign in, click each tab | ☐ |
| B13 | `/admin/import` accepts a CSV (dry run first, then real import) | Upload a 2-row CSV | ☐ |
| B14 | `/admin/audit-logs` shows recent admin writes | Click 審計日誌 tab | ☐ |
| B15 | `/api/admin/customers/[id]/export` returns a JSON download with all related rows | curl with admin session | ☐ |
| B16 | `/api/admin/customers/[id]/gdpr-delete` (POST) cascades through dependent tables and writes the audit row | curl with admin session, check audit log | ☐ |
| B17 | Vercel cron hits `/api/cron/reminders?secret=...` hourly; for a booking 24h out, an email is sent and a `reminder_24h` row appears in `notifications` | Create a booking 24h out, wait for cron | ☐ |
| B18 | Open Graph / Twitter meta renders on share preview | https://www.opengraph.xyz/ | ☐ |
| B19 | Lighthouse: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95 | Chrome DevTools → Lighthouse | ☐ |
| B20 | Mobile (390px) — every page is usable: tap targets, no horizontal scroll, forms complete | iPhone SE simulator or DevTools responsive | ☐ |

## C. Rollback plan

If a deploy introduces a regression that the smoke flow catches:

1. **Vercel** → Deployments → select the last working deployment → "Promote to Production". This is a one-click rollback.
2. **Database** — no schema changes were applied during this code freeze, so no SQL rollback is needed for the code itself. If you did run the new migrations, you can re-run them in a hot-fix migration; the two new ones (`..._notifications_table.sql`, `..._package_redeem_rpc.sql`) are additive only.
3. **Cron** — the reminder cron targets a stable endpoint. If a bad reminder goes out, pause the cron in Vercel → Settings → Crons until the issue is fixed.

## D. On-call playbook

- **Booking flow broken** → check Vercel function logs for `/api/appointments`. Common: missing `SUPABASE_SERVICE_ROLE_KEY`, or DB constraint failure (e.g. phone format).
- **Stripe webhook 4xx** → check `/api/stripe/webhook` logs. 400s usually mean `STRIPE_WEBHOOK_SECRET` mismatch. The endpoint is idempotent so re-sending is safe.
- **Reminder spam** → check the `notifications` table for the latest `reminder_24h` rows; a missing index would re-send for the same booking. Stop the cron first, then fix.
- **Admin locked out** → re-issue a Supabase Auth invite, then `insert into admin_users (user_id, is_active) values (...);` from the SQL editor.
- **Customer requests GDPR data export** → admin → customer detail → click "Export JSON" (or hit the API directly until the button lands).
- **Customer requests deletion** → admin → customer detail → click "GDPR delete" with a confirmation dialog. Verify in `admin_audit_logs` afterwards.

## E. Open follow-ups (not blocking launch)

| # | Item | Why | Effort |
|---|------|-----|--------|
| 1 | `SalonAdminModules.jsx` / `SalonCustomerModules.jsx` split into per-tab files | Easier maintenance as modules grow | Medium |
| 2 | WhatsApp Business Cloud integration in `lib/notifications/notify.js` (currently a stub) | Lets confirmations actually reach the customer's phone | Medium (requires Twilio or Meta approval) |
| 3 | E2E / Playwright smoke test that runs against the production URL on a schedule | Catches regressions in the customer flow automatically | Medium |
| 4 | i18n `en` translations for the remaining static pages (`/about`, `/contact`, `/gallery`, `/privacy`, `/terms`, `/location`) | Currently Chinese only | Small |
| 5 | Admin UI button to trigger the GDPR export and delete per customer | API endpoints exist (`/api/admin/customers/[id]/export`, `/.../gdpr-delete`); only the button is missing | Small |
| 6 | Email template HTML polish (logo, brand bar, mobile responsive) | Currently functional but plain | Small |

## F. Repository state

- 15 commits on master between `75c0ff2` and `6486c17`
- 87 unit tests (all pass) covering booking validation, package redemption, notifications, CSV import, i18n, signin routes, schema security, repository hygiene
- `npm run build` produces 48 routes (17 static + 31 dynamic) with zero errors
- All changes committed + pushed to `PANDORASPA/hk-salon-viva-fresh` master
- Branch protection recommended on master once a second maintainer joins
