# Salon Poke Deployment

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` — server only, never prefixed with `NEXT_PUBLIC_`
- `NEXT_PUBLIC_SITE_URL`

Use separate reviewed Preview and Production project settings. Set the exact authorised origin for each environment; no historical Bristol URL is a production default. Follow the [current operations runbook](booking-platform-operations.md) and [launch checklist](launch-checklist-2026-09-14.md). Online Stripe payments remain hard-disabled regardless of environment configuration.

## Release procedure

1. Confirm a recoverable backup, rehearse all current migrations on an isolated clone, and obtain explicit approval before target migration. Never automatically apply demo seeds to production.
2. Configure Preview variables in Vercel.
3. Deploy the feature branch and run the complete public, booking, customer, and admin browser checks.
4. Inspect build and runtime error logs.
5. Merge the reviewed branch, connect Vercel Git deployment, and deploy Production.
6. Repeat smoke tests against the production alias and record the previous deployment as rollback candidate.

Never overwrite the production alias before the Preview artifact and its database configuration have passed verification.
