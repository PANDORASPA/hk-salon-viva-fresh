-- Task 9 Fix Round 3: inactive staff are forbidden only for appointments
-- whose active occupied range reaches beyond the database transaction time.
begin;

create or replace function public.booking_enforce_active_staff()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  -- occupied_until is generated from ends_at + buffer_minutes by
  -- salon_appointment_occupancy. Both it and now() are timestamptz values, so
  -- this is an absolute database-time comparison independent of session TZ.
  if new.status in ('pending','confirmed','completed')
    and new.occupied_until > now()
    and not public.booking_lock_active_staff(new.staff_id) then
    raise exception 'staff_unavailable' using errcode='B0018';
  end if;
  return new;
end $$;

-- PostgreSQL fires same-kind triggers alphabetically. Naming this after the
-- occupancy trigger means the invariant sees the final occupied_until on
-- direct SQL, retained RPCs, and every server-side update shape.
drop trigger if exists booking_enforce_active_staff on public.appointments;
drop trigger if exists z_booking_enforce_active_staff on public.appointments;
create trigger z_booking_enforce_active_staff
  before insert or update of staff_id, status, starts_at, ends_at, occupied_until, buffer_minutes on public.appointments
  for each row execute function public.booking_enforce_active_staff();

commit;
