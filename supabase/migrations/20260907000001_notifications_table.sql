-- 20260907000001_notifications_table.sql
-- Append-only notification log used by `lib/notifications/notify.js`.
-- RLS keeps customer contact info admin-only.

create table if not exists public.notifications (
  id bigserial primary key,
  event text not null,
  booking_id bigint references public.appointments(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_email text,
  starts_at timestamptz,
  whatsapp_body text,
  email_subject text,
  email_body text,
  package_refunded boolean default false,
  delivered_at timestamptz default now(),
  channel_results jsonb
);

create index if not exists notifications_booking_idx
  on public.notifications (booking_id);

create index if not exists notifications_event_idx
  on public.notifications (event);

alter table public.notifications enable row level security;

-- Only admins (via is_salon_admin) can read notifications; service_role bypasses.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'admin_read_notifications'
  ) then
    create policy admin_read_notifications on public.notifications
      for select to authenticated using (public.is_salon_admin());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'admin_write_notifications'
  ) then
    create policy admin_write_notifications on public.notifications
      for insert to authenticated with check (public.is_salon_admin());
  end if;
end$$;
