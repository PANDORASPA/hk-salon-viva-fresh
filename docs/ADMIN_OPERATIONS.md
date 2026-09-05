# Salon Poke Admin Operations

## First administrator

1. Apply all migrations and the Salon Poke seed.
2. Create the owner in Supabase Authentication using a private email and a unique password. Do not put the password in Git, Vercel comments, screenshots, or chat.
3. Copy the Auth user's UUID and run this once in the Supabase SQL editor:

```sql
insert into public.admin_users (user_id, is_active)
values ('AUTH-USER-UUID', true)
on conflict (user_id) do update set is_active = true;
```

4. Sign in at `/admin/login`. Add future administrators from the Administrators module.

The database prevents revocation or deletion of the final active administrator.

## Routine use

- Appointments: confirm requests, complete services, cancel, or mark no-show.
- Services: add services and publish/unpublish prices shown to customers.
- Schedule: maintain all seven weekdays and add exceptional closures.
- Gallery: upload JPG, PNG, or WebP images under 10 MB with meaningful alt text.
- Site content: keep WhatsApp, email, Instagram, area, salon name, and hero title current.
- Administrators: invite only trusted staff and revoke access promptly when it is no longer required.

## Recovery

Database data should be backed up using Supabase backups before schema changes. Gallery originals live in the `salon-gallery` Storage bucket. Application rollback uses the previous READY Vercel deployment; database migrations are forward-only and must be reviewed separately before rollback.
