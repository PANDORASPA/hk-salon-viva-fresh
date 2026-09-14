-- Task 9 Fix Round 2: make every future-active appointment transition pass
-- the staff lock/recheck, and make audit rows server-only writes.
begin;

drop trigger if exists booking_enforce_active_staff on public.appointments;
create trigger booking_enforce_active_staff
  before insert or update of staff_id, status, starts_at, ends_at on public.appointments
  for each row execute function public.booking_enforce_active_staff();

alter table public.admin_audit_logs enable row level security;

-- Remove every browser-write policy, including any historical ALL policy. The
-- command functions are SECURITY INVOKER and service_role is the only caller
-- granted the INSERT privilege required for their in-transaction audit row.
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_logs'
      and upper(cmd) <> 'SELECT'
  loop
    execute format('drop policy if exists %I on public.admin_audit_logs', policy_row.policyname);
  end loop;
end $$;

drop policy if exists "Salon admins read audit" on public.admin_audit_logs;
create policy "Salon admins read audit"
  on public.admin_audit_logs
  for select
  to authenticated
  using ((select public.is_salon_admin()));

revoke insert, update, delete on public.admin_audit_logs from public, anon, authenticated;
grant select, insert on public.admin_audit_logs to service_role;

commit;
