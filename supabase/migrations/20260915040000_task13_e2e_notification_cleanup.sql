-- A narrowly-scoped cleanup capability for isolated E2E databases. Notification
-- rows contain contact data, so service_role intentionally has no table DELETE.
create or replace function public.e2e_cleanup_notifications(
  p_marker text,
  p_appointment_ids bigint[],
  p_namespace text
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  configured_marker text;
  matching_appointments integer;
begin
  -- PostgREST supplies request.jwt.claim.role; current_setting('role') keeps
  -- direct local service-role invocations testable without widening browser use.
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'E2E notification cleanup requires service_role';
  end if;

  if p_marker is null or p_namespace is null
     or p_namespace !~ '^[a-z][a-z0-9_]{2,48}$'
     or coalesce(array_length(p_appointment_ids, 1), 0) = 0
     or array_position(p_appointment_ids, null) is not null
     or (select count(distinct id) from unnest(p_appointment_ids) as input(id)) <> cardinality(p_appointment_ids) then
    raise exception 'invalid E2E notification cleanup scope';
  end if;

  select data ->> 'e2e_marker' into configured_marker
  from public.app_settings where id = 1;
  if configured_marker is distinct from p_marker then
    raise exception 'E2E database marker did not match';
  end if;

  select count(*) into matching_appointments
  from public.appointments
  where id = any(p_appointment_ids)
    and left(coalesce(customer_name, ''), length(p_namespace) + 1) = p_namespace || ' ';
  if matching_appointments <> cardinality(p_appointment_ids) then
    raise exception 'E2E appointment IDs are outside the fixture namespace';
  end if;

  delete from public.notifications where booking_id = any(p_appointment_ids);
end;
$$;

revoke all on function public.e2e_cleanup_notifications(text, bigint[], text) from public, anon, authenticated;
grant execute on function public.e2e_cleanup_notifications(text, bigint[], text) to service_role;
