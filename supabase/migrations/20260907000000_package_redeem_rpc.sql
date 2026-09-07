-- 20260907000000_package_redeem_rpc.sql
-- Atomic package redemption + refund RPCs.
--
-- Background: previous booking code did read-modify-write on
-- `customer_packages.sessions_remaining` from the application layer, which
-- can lose updates under concurrency (two parallel bookings of the same
-- package slot can both succeed and only decrement once). This migration
-- provides SECURITY DEFINER functions that perform the redemption atomically
-- in a single transaction.
--
-- The application falls back to the legacy two-step path if these RPCs are
-- not present (see `lib/booking/package-usage.js`), so this migration is
-- safe to apply at any time.
--
-- Pre-requisites (provided by earlier migrations in this repo):
--   - public.customer_packages  (id, customer_id, package_id, total_sessions,
--                                sessions_remaining, is_active, expires_at, ...)
--   - public.appointments       (id, customer_id, customer_package_id, status, ...)
--   - public.package_redemptions(id, customer_package_id, appointment_id, redeemed_at)
--
-- If `package_redemptions` does not yet exist in your environment, the second
-- insert inside `redeem_customer_package` will raise — apply the create-table
-- statement at the bottom of this file first.

create or replace function public.redeem_customer_package(
  p_customer_package_id bigint,
  p_appointment_id bigint
) returns public.package_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cp public.customer_packages%rowtype;
  v_row public.package_redemptions%rowtype;
begin
  -- Lock the package row to serialise concurrent redemptions
  select * into v_cp
  from public.customer_packages
  where id = p_customer_package_id
  for update;

  if not found then
    raise exception 'customer_package_not_found' using errcode = 'P0002';
  end if;
  if not v_cp.is_active then
    raise exception 'customer_package_inactive' using errcode = 'P0001';
  end if;
  if v_cp.expires_at <= now() then
    raise exception 'customer_package_expired' using errcode = 'P0001';
  end if;
  if coalesce(v_cp.sessions_remaining, 0) < 1 then
    raise exception 'customer_package_exhausted' using errcode = 'P0001';
  end if;

  update public.customer_packages
  set sessions_remaining = v_cp.sessions_remaining - 1
  where id = v_cp.id;

  insert into public.package_redemptions (customer_package_id, appointment_id, redeemed_at)
  values (v_cp.id, p_appointment_id, now())
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.refund_customer_package(
  p_customer_package_id bigint,
  p_appointment_id bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cp public.customer_packages%rowtype;
  v_deleted int;
begin
  select * into v_cp
  from public.customer_packages
  where id = p_customer_package_id
  for update;

  if not found then
    raise exception 'customer_package_not_found' using errcode = 'P0002';
  end if;

  delete from public.package_redemptions
  where customer_package_id = p_customer_package_id
    and appointment_id = p_appointment_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    -- Nothing to refund; treat as no-op
    return;
  end if;

  update public.customer_packages
  set sessions_remaining = least(
    coalesce(v_cp.total_sessions, v_cp.sessions_remaining + 1),
    v_cp.sessions_remaining + 1
  )
  where id = v_cp.id;
end;
$$;

-- Legacy alias — the existing `app/api/appointments/route.js` calls
-- `deduct_package_session` rather than `redeem_customer_package`. Keep the
-- old name working so the current booking flow does not break before the
-- code is updated to the new helper.
create or replace function public.deduct_package_session(
  p_customer_package_id bigint,
  p_appointment_id bigint
) returns public.package_redemptions
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.redeem_customer_package(p_customer_package_id, p_appointment_id);
end;
$$;

revoke all on function public.redeem_customer_package(bigint, bigint) from public;
revoke all on function public.refund_customer_package(bigint, bigint) from public;
revoke all on function public.deduct_package_session(bigint, bigint) from public;
grant execute on function public.redeem_customer_package(bigint, bigint) to service_role;
grant execute on function public.refund_customer_package(bigint, bigint) to service_role;
grant execute on function public.deduct_package_session(bigint, bigint) to service_role;

-- If `package_redemptions` does not exist yet, create it.
create table if not exists public.package_redemptions (
  id bigserial primary key,
  customer_package_id bigint not null references public.customer_packages(id) on delete cascade,
  appointment_id bigint not null references public.appointments(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  refunded_at timestamptz,
  unique (appointment_id)
);

create index if not exists package_redemptions_pkg_idx
  on public.package_redemptions (customer_package_id);

-- Allow service_role to read/write; the application uses service_role for
-- server-side booking writes, so this is the role that needs the grant.
alter table public.package_redemptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'package_redemptions' and policyname = 'service_role_all'
  ) then
    create policy service_role_all on public.package_redemptions
      for all to service_role using (true) with check (true);
  end if;
end$$;
