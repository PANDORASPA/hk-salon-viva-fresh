# Salon Poke Deployment

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` — server only, never prefixed with `NEXT_PUBLIC_`
- `NEXT_PUBLIC_SITE_URL`

Set all four for Preview and Production. Use the Preview URL while testing; set the production value to `https://lo-chan-hair-bristol.vercel.app` only for the production environment.

## Release procedure

1. Apply migrations and seed to the controlled Supabase project.
2. Configure Preview variables in Vercel.
3. Deploy the feature branch and run the complete public, booking, customer, and admin browser checks.
4. Inspect build and runtime error logs.
5. Merge the reviewed branch, connect Vercel Git deployment, and deploy Production.
6. Repeat smoke tests against the production alias and record the previous deployment as rollback candidate.

Never overwrite the production alias before the Preview artifact and its database configuration have passed verification.
