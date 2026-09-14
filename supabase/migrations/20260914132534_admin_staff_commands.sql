-- Staff administration needs relationship replacement that PostgREST cannot
-- compose into one client-side transaction. These invoker commands are only
-- executable by the service-role client after the route has rechecked admin
-- membership, CSRF/origin, rate limits, validation, and audit logging.
begin;

create or replace function public.admin_assert_staff_payload(
  p_name text, p_display_name text, p_bio text, p_colour_hex text,
  p_is_active boolean, p_sort_order integer, p_service_ids bigint[]
) returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_service_count integer;
begin
  if p_name is null or length(trim(p_name)) not between 2 and 120
    or p_display_name is null or length(trim(p_display_name)) not between 2 and 120
    or length(coalesce(p_bio,'')) > 2000
    or p_colour_hex is null or p_colour_hex !~ '^#[0-9a-fA-F]{6}$'
    or p_is_active is null or p_sort_order is null or p_sort_order not between -100000 and 100000
    or exists (select 1 from unnest(coalesce(p_service_ids,'{}'::bigint[])) id where id < 1)
    or coalesce(array_length(p_service_ids,1),0) <> (select count(distinct id) from unnest(coalesce(p_service_ids,'{}'::bigint[])) id)
  then raise exception 'invalid_staff_payload' using errcode='B0011'; end if;
  select count(*) into v_service_count from public.services where id=any(coalesce(p_service_ids,'{}'::bigint[]));
  if v_service_count <> coalesce(array_length(p_service_ids,1),0) then
    raise exception 'invalid_staff_payload' using errcode='B0011';
  end if;
end $$;

create or replace function public.admin_create_staff(
  p_name text, p_display_name text, p_bio text, p_colour_hex text,
  p_is_active boolean, p_sort_order integer, p_service_ids bigint[]
) returns public.staff language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_staff public.staff%rowtype;
begin
  perform public.admin_assert_staff_payload(p_name,p_display_name,p_bio,p_colour_hex,p_is_active,p_sort_order,p_service_ids);
  insert into public.staff(name,display_name,bio,colour_hex,is_active,sort_order)
    values (trim(p_name),trim(p_display_name),nullif(trim(p_bio),''),lower(p_colour_hex),p_is_active,p_sort_order)
    returning * into v_staff;
  insert into public.staff_services(staff_id,service_id)
    select v_staff.id,id from unnest(coalesce(p_service_ids,'{}'::bigint[])) id;
  return v_staff;
end $$;

create or replace function public.admin_update_staff(
  p_staff_id bigint, p_name text, p_display_name text, p_bio text, p_colour_hex text,
  p_is_active boolean, p_sort_order integer, p_service_ids bigint[]
) returns public.staff language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_staff public.staff%rowtype;
begin
  perform public.admin_assert_staff_payload(p_name,p_display_name,p_bio,p_colour_hex,p_is_active,p_sort_order,p_service_ids);
  select * into v_staff from public.staff where id=p_staff_id for update;
  if not found then raise exception 'staff_not_found' using errcode='B0012'; end if;
  if not p_is_active and exists (
    select 1 from public.appointments
      where staff_id=p_staff_id and starts_at > now() and status in ('pending','confirmed','completed')
  ) then raise exception 'staff_has_future_appointments' using errcode='B0013'; end if;
  update public.staff set name=trim(p_name),display_name=trim(p_display_name),bio=nullif(trim(p_bio),''),
    colour_hex=lower(p_colour_hex),is_active=p_is_active,sort_order=p_sort_order where id=p_staff_id returning * into v_staff;
  delete from public.staff_services where staff_id=p_staff_id;
  insert into public.staff_services(staff_id,service_id)
    select p_staff_id,id from unnest(coalesce(p_service_ids,'{}'::bigint[])) id;
  return v_staff;
end $$;

create or replace function public.admin_delete_staff(p_staff_id bigint)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.appointments where staff_id=p_staff_id and starts_at > now()
    and status in ('pending','confirmed','completed')) then
    raise exception 'staff_has_future_appointments' using errcode='B0013';
  end if;
  if exists (select 1 from public.appointments where staff_id=p_staff_id) then
    raise exception 'staff_has_appointments' using errcode='B0014';
  end if;
  delete from public.staff where id=p_staff_id;
  if not found then raise exception 'staff_not_found' using errcode='B0012'; end if;
  return true;
end $$;

create or replace function public.admin_replace_staff_weekly_hours(p_staff_id bigint, p_hours jsonb)
returns setof public.staff_weekly_hours language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.staff where id=p_staff_id for update)
    or jsonb_typeof(p_hours) <> 'array'
    or (select count(*) from jsonb_to_recordset(p_hours) as h(weekday integer, "isWorking" boolean, "startsAt" text, "endsAt" text)) <> 7
    or (select count(distinct weekday) from jsonb_to_recordset(p_hours) as h(weekday integer, "isWorking" boolean, "startsAt" text, "endsAt" text)) <> 7
    or exists (select 1 from jsonb_to_recordset(p_hours) as h(weekday integer, "isWorking" boolean, "startsAt" text, "endsAt" text)
      where weekday not between 0 and 6 or "isWorking" is null
        or ("isWorking" and ("startsAt" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
          or "endsAt" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' or "startsAt" >= "endsAt"))
        or (not "isWorking" and ("startsAt" is not null or "endsAt" is not null)))
  then raise exception 'invalid_staff_weekly_hours' using errcode='B0015'; end if;

  -- The primary key permits exactly one interval per weekday. Requiring every
  -- weekday once makes overlap impossible and DELETE+INSERT is one transaction.
  delete from public.staff_weekly_hours where staff_id=p_staff_id;
  insert into public.staff_weekly_hours(staff_id,weekday,is_working,starts_at,ends_at)
    select p_staff_id,weekday,"isWorking",case when "isWorking" then "startsAt"::time else null end,
      case when "isWorking" then "endsAt"::time else null end
    from jsonb_to_recordset(p_hours) as h(weekday integer, "isWorking" boolean, "startsAt" text, "endsAt" text)
    order by weekday;
  return query select * from public.staff_weekly_hours where staff_id=p_staff_id order by weekday;
end $$;

create or replace function public.admin_create_staff_time_off(
  p_staff_id bigint, p_starts_at timestamptz, p_ends_at timestamptz, p_reason text, p_created_by uuid
) returns public.staff_time_off language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_time_off public.staff_time_off%rowtype;
begin
  if not exists (select 1 from public.staff where id=p_staff_id)
    or p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_ends_at <= p_starts_at or length(coalesce(p_reason,'')) > 500
  then raise exception 'invalid_staff_time_off' using errcode='B0016'; end if;
  insert into public.staff_time_off(staff_id,starts_at,ends_at,reason,created_by)
    values(p_staff_id,p_starts_at,p_ends_at,nullif(trim(p_reason),''),p_created_by) returning * into v_time_off;
  return v_time_off;
end $$;

create or replace function public.admin_delete_staff_time_off(p_staff_id bigint, p_time_off_id bigint)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  delete from public.staff_time_off where id=p_time_off_id and staff_id=p_staff_id;
  if not found then raise exception 'staff_time_off_not_found' using errcode='B0017'; end if;
  return true;
end $$;

revoke all on function public.admin_assert_staff_payload(text,text,text,text,boolean,integer,bigint[]),
  public.admin_create_staff(text,text,text,text,boolean,integer,bigint[]),
  public.admin_update_staff(bigint,text,text,text,text,boolean,integer,bigint[]),
  public.admin_delete_staff(bigint), public.admin_replace_staff_weekly_hours(bigint,jsonb),
  public.admin_create_staff_time_off(bigint,timestamptz,timestamptz,text,uuid),
  public.admin_delete_staff_time_off(bigint,bigint) from public, anon, authenticated;
grant execute on function public.admin_assert_staff_payload(text,text,text,text,boolean,integer,bigint[]),
  public.admin_create_staff(text,text,text,text,boolean,integer,bigint[]),
  public.admin_update_staff(bigint,text,text,text,text,boolean,integer,bigint[]),
  public.admin_delete_staff(bigint), public.admin_replace_staff_weekly_hours(bigint,jsonb),
  public.admin_create_staff_time_off(bigint,timestamptz,timestamptz,text,uuid),
  public.admin_delete_staff_time_off(bigint,bigint) to service_role;

commit;
