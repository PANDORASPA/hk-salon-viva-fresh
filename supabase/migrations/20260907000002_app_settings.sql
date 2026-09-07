-- 20260907000002_app_settings.sql
-- Single-row runtime-tunable settings store for the salon admin panel.
--
-- The Settings page reads/writes a JSONB blob here so admins can change
-- notification preferences, cancellation cutoffs, and reminder lead time
-- without a redeploy. The seeded defaults mirror the historical env-var
-- behaviour so the system is no worse than before this migration.
--
-- Reads in the booking / cron paths are designed to be safe when the row
-- is missing — they fall back to the seeded defaults below.

create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, data)
values (
  1,
  jsonb_build_object(
    'reminder_hours_before', 24,
    'cancel_cutoff_hours', 24,
    'booking_buffer_minutes', 0,
    'notify_email_enabled', true,
    'notify_whatsapp_enabled', false,
    'notify_console_enabled', true,
    'notify_dry_run', true,
    'auto_issue_packages', true,
    'require_deposit', false,
    'whatsapp_provider', 'off',
    'email_provider', 'resend'
  )
)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

-- Only admins can read or write; service_role bypasses RLS for cron jobs.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_settings' and policyname = 'admin_read_app_settings'
  ) then
    create policy admin_read_app_settings on public.app_settings
      for select to authenticated using (public.is_salon_admin());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_settings' and policyname = 'admin_write_app_settings'
  ) then
    create policy admin_write_app_settings on public.app_settings
      for update to authenticated using (public.is_salon_admin()) with check (public.is_salon_admin());
  end if;
end$$;
