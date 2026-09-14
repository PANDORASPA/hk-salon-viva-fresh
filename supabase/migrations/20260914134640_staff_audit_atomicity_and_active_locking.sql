-- Additive repair for Task 9: staff state changes and their immutable audit
-- record are one transaction. The service-role route supplies an authenticated
-- admin id; actions, table names, and before/after data are fixed here.
begin;

create or replace function public.admin_require_active_actor(p_actor_id uuid)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if p_actor_id is null or not exists (select 1 from public.admin_users where user_id=p_actor_id and is_active) then
    raise exception 'admin_forbidden' using errcode='B0019';
  end if;
end $$;

create or replace function public.admin_staff_snapshot(p_staff_id bigint)
returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
  select to_jsonb(s) || jsonb_build_object('serviceIds',coalesce((select jsonb_agg(ss.service_id order by ss.service_id)
    from public.staff_services ss where ss.staff_id=s.id),'[]'::jsonb)) from public.staff s where s.id=p_staff_id;
$$;

create or replace function public.admin_create_staff_audited(
  p_actor_id uuid, p_name text, p_display_name text, p_bio text, p_colour_hex text,
  p_is_active boolean, p_sort_order integer, p_service_ids bigint[]
) returns public.staff language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_staff public.staff%rowtype; v_after jsonb;
begin
  perform public.admin_require_active_actor(p_actor_id);
  perform public.admin_assert_staff_payload(p_name,p_display_name,p_bio,p_colour_hex,p_is_active,p_sort_order,p_service_ids);
  insert into public.staff(name,display_name,bio,colour_hex,is_active,sort_order)
    values(trim(p_name),trim(p_display_name),nullif(trim(p_bio),''),lower(p_colour_hex),p_is_active,p_sort_order) returning * into v_staff;
  insert into public.staff_services(staff_id,service_id)
    select v_staff.id,id from unnest(coalesce(p_service_ids,'{}'::bigint[])) id;
  v_after := public.admin_staff_snapshot(v_staff.id);
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,after_data,metadata)
    values(p_actor_id,p_actor_id,'staff.create','staff',v_staff.id::text,'staff',v_staff.id::text,v_after,jsonb_build_object('after',v_after));
  return v_staff;
end $$;

create or replace function public.admin_update_staff_audited(
  p_actor_id uuid, p_staff_id bigint, p_name text, p_display_name text, p_bio text, p_colour_hex text,
  p_is_active boolean, p_sort_order integer, p_service_ids bigint[]
) returns public.staff language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_staff public.staff%rowtype; v_before jsonb; v_after jsonb;
begin
  perform public.admin_require_active_actor(p_actor_id);
  perform public.admin_assert_staff_payload(p_name,p_display_name,p_bio,p_colour_hex,p_is_active,p_sort_order,p_service_ids);
  select * into v_staff from public.staff where id=p_staff_id for update;
  if not found then raise exception 'staff_not_found' using errcode='B0012'; end if;
  v_before := public.admin_staff_snapshot(p_staff_id);
  if not p_is_active and exists (select 1 from public.appointments where staff_id=p_staff_id and starts_at > now()
    and status in ('pending','confirmed','completed')) then raise exception 'staff_has_future_appointments' using errcode='B0013'; end if;
  update public.staff set name=trim(p_name),display_name=trim(p_display_name),bio=nullif(trim(p_bio),''),
    colour_hex=lower(p_colour_hex),is_active=p_is_active,sort_order=p_sort_order where id=p_staff_id returning * into v_staff;
  delete from public.staff_services where staff_id=p_staff_id;
  insert into public.staff_services(staff_id,service_id) select p_staff_id,id from unnest(coalesce(p_service_ids,'{}'::bigint[])) id;
  v_after := public.admin_staff_snapshot(p_staff_id);
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,'staff.update','staff',p_staff_id::text,'staff',p_staff_id::text,v_before,v_after,jsonb_build_object('before',v_before,'after',v_after));
  return v_staff;
end $$;

create or replace function public.admin_delete_staff_audited(p_actor_id uuid, p_staff_id bigint)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_before jsonb;
begin
  perform public.admin_require_active_actor(p_actor_id);
  select public.admin_staff_snapshot(p_staff_id) into v_before from public.staff where id=p_staff_id for update;
  if not found then raise exception 'staff_not_found' using errcode='B0012'; end if;
  if exists (select 1 from public.appointments where staff_id=p_staff_id and starts_at > now() and status in ('pending','confirmed','completed'))
    then raise exception 'staff_has_future_appointments' using errcode='B0013'; end if;
  if exists (select 1 from public.appointments where staff_id=p_staff_id) then raise exception 'staff_has_appointments' using errcode='B0014'; end if;
  delete from public.staff where id=p_staff_id;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,metadata)
    values(p_actor_id,p_actor_id,'staff.delete','staff',p_staff_id::text,'staff',p_staff_id::text,v_before,jsonb_build_object('before',v_before));
  return true;
end $$;

create or replace function public.admin_replace_staff_weekly_hours_audited(p_actor_id uuid,p_staff_id bigint,p_hours jsonb)
returns setof public.staff_weekly_hours language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_before jsonb; v_after jsonb;
begin
  perform public.admin_require_active_actor(p_actor_id);
  if not exists (select 1 from public.staff where id=p_staff_id for update)
    or jsonb_typeof(p_hours) <> 'array'
    or (select count(*) from jsonb_to_recordset(p_hours) as h(weekday integer, "isWorking" boolean, "startsAt" text, "endsAt" text)) <> 7
    or (select count(distinct weekday) from jsonb_to_recordset(p_hours) as h(weekday integer, "isWorking" boolean, "startsAt" text, "endsAt" text)) <> 7
    or exists (select 1 from jsonb_to_recordset(p_hours) as h(weekday integer, "isWorking" boolean, "startsAt" text, "endsAt" text)
      where weekday not between 0 and 6 or "isWorking" is null or ("isWorking" and ("startsAt" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        or "endsAt" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' or "startsAt">="endsAt")) or (not "isWorking" and ("startsAt" is not null or "endsAt" is not null)))
  then raise exception 'invalid_staff_weekly_hours' using errcode='B0015'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'isWorking',is_working,'startsAt',starts_at::text,'endsAt',ends_at::text) order by weekday),'[]'::jsonb)
    into v_before from public.staff_weekly_hours where staff_id=p_staff_id;
  delete from public.staff_weekly_hours where staff_id=p_staff_id;
  insert into public.staff_weekly_hours(staff_id,weekday,is_working,starts_at,ends_at)
    select p_staff_id,weekday,"isWorking",case when "isWorking" then "startsAt"::time else null end,case when "isWorking" then "endsAt"::time else null end
    from jsonb_to_recordset(p_hours) as h(weekday integer, "isWorking" boolean, "startsAt" text, "endsAt" text) order by weekday;
  select jsonb_agg(jsonb_build_object('weekday',weekday,'isWorking',is_working,'startsAt',starts_at::text,'endsAt',ends_at::text) order by weekday)
    into v_after from public.staff_weekly_hours where staff_id=p_staff_id;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,'staff.hours.replace','staff_weekly_hours',p_staff_id::text,'staff_weekly_hours',p_staff_id::text,v_before,v_after,jsonb_build_object('before',v_before,'after',v_after));
  return query select * from public.staff_weekly_hours where staff_id=p_staff_id order by weekday;
end $$;

create or replace function public.admin_create_staff_time_off_audited(
  p_actor_id uuid,p_staff_id bigint,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text
) returns public.staff_time_off language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_time_off public.staff_time_off%rowtype; v_after jsonb;
begin
  perform public.admin_require_active_actor(p_actor_id);
  if not exists (select 1 from public.staff where id=p_staff_id for update) or p_starts_at is null or p_ends_at is null
    or not isfinite(p_starts_at) or not isfinite(p_ends_at) or p_ends_at<=p_starts_at or length(coalesce(p_reason,''))>500
  then raise exception 'invalid_staff_time_off' using errcode='B0016'; end if;
  insert into public.staff_time_off(staff_id,starts_at,ends_at,reason,created_by)
    values(p_staff_id,p_starts_at,p_ends_at,nullif(trim(p_reason),''),p_actor_id) returning * into v_time_off;
  v_after := to_jsonb(v_time_off);
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,after_data,metadata)
    values(p_actor_id,p_actor_id,'staff.time_off.create','staff_time_off',v_time_off.id::text,'staff_time_off',v_time_off.id::text,v_after,jsonb_build_object('after',v_after));
  return v_time_off;
end $$;

create or replace function public.admin_delete_staff_time_off_audited(p_actor_id uuid,p_staff_id bigint,p_time_off_id bigint)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_before jsonb;
begin
  perform public.admin_require_active_actor(p_actor_id);
  select to_jsonb(t) into v_before from public.staff_time_off t where id=p_time_off_id and staff_id=p_staff_id for update;
  if not found then raise exception 'staff_time_off_not_found' using errcode='B0017'; end if;
  delete from public.staff_time_off where id=p_time_off_id;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,metadata)
    values(p_actor_id,p_actor_id,'staff.time_off.delete','staff_time_off',p_time_off_id::text,'staff_time_off',p_time_off_id::text,v_before,jsonb_build_object('before',v_before));
  return true;
end $$;

-- All booking paths, including retained legacy server RPCs and direct server
-- inserts, take a SHARE lock and recheck active state immediately before write.
create or replace function public.booking_lock_active_staff(p_staff_id bigint)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_active boolean;
begin
  select is_active into v_active from public.staff where id=p_staff_id for share;
  return coalesce(v_active,false);
end $$;

create or replace function public.booking_enforce_active_staff()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.status in ('pending','confirmed','completed') and not public.booking_lock_active_staff(new.staff_id) then
    raise exception 'staff_unavailable' using errcode='B0018';
  end if;
  return new;
end $$;
drop trigger if exists booking_enforce_active_staff on public.appointments;
create trigger booking_enforce_active_staff before insert or update of staff_id,status on public.appointments
  for each row execute function public.booking_enforce_active_staff();

create or replace function public.booking_slot_candidates(
  p_service_id bigint,p_starts_at timestamptz,p_staff_preference text,p_ignore_appointment_id bigint default null
) returns table(staff_id bigint,ends_at timestamptz,buffer_minutes integer)
language plpgsql security invoker set search_path = '' as $$
declare v_service public.services%rowtype; v_settings jsonb; v_hours public.business_hours%rowtype; v_date date; v_local timestamp;
  v_end timestamptz; v_occupied timestamptz; v_buffer integer; v_step numeric; v_lead numeric; v_horizon numeric;
begin
  select * into v_service from public.services where id=p_service_id and enabled and published for share;
  if not found then raise exception 'service_unavailable' using errcode='B0004'; end if;
  select data into v_settings from public.app_settings where id=1 for share;
  begin
    v_buffer:=coalesce(v_settings->>'booking_buffer_minutes',v_settings->>'buffer_minutes',v_settings->>'bufferMinutes','15')::integer;
    v_step:=coalesce(v_settings->>'slot_step_minutes',v_settings->>'step_minutes',v_settings->>'stepMinutes','30')::numeric;
    v_lead:=greatest(0,coalesce(v_settings->>'minimum_lead_minutes',v_settings->>'minimumLeadMinutes','120')::numeric);
    v_horizon:=greatest(0,coalesce(v_settings->>'maximum_advance_days',v_settings->>'maximumAdvanceDays','90')::numeric);
  exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'booking_window_invalid' using errcode='B0005'; end;
  if v_buffer not between 0 and 120 or v_step<=0 or v_step>1440 or v_step::text in ('NaN','Infinity','-Infinity')
    or v_lead::text in ('NaN','Infinity','-Infinity') or v_horizon::text in ('NaN','Infinity','-Infinity') or p_starts_at is null or not isfinite(p_starts_at)
    or p_starts_at<now()+v_lead*interval '1 minute' or p_starts_at>now()+v_horizon*interval '1 day' then raise exception 'booking_window_invalid' using errcode='B0005'; end if;
  if p_staff_preference is null or (p_staff_preference<>'any' and p_staff_preference !~ '^[1-9][0-9]*$') then raise exception 'validation_error' using errcode='B0006'; end if;
  v_local:=p_starts_at at time zone 'Asia/Hong_Kong'; v_date:=v_local::date; v_end:=p_starts_at+make_interval(mins=>v_service.duration_minutes); v_occupied:=v_end+make_interval(mins=>v_buffer);
  select * into v_hours from public.business_hours where weekday=extract(dow from v_date) for share;
  if not found or not v_hours.is_open or exists(select 1 from public.blocked_dates where starts_on<=v_date and ends_on>=v_date) then return; end if;
  return query select s.id,v_end,v_buffer from public.staff s join public.staff_services skill on skill.staff_id=s.id and skill.service_id=p_service_id
    join public.staff_weekly_hours h on h.staff_id=s.id and h.weekday=extract(dow from v_date)
    where s.is_active and public.booking_lock_active_staff(s.id) and h.is_working and (p_staff_preference='any' or s.id::text=p_staff_preference)
      and v_local>=v_date+greatest(v_hours.opens_at,h.starts_at) and (v_occupied at time zone 'Asia/Hong_Kong')<=v_date+least(v_hours.closes_at,h.ends_at)
      and mod(extract(epoch from(v_local-(v_date+greatest(v_hours.opens_at,h.starts_at)))),v_step*60)=0
      and not exists(select 1 from public.staff_time_off off_time where off_time.staff_id=s.id and off_time.starts_at<v_occupied and off_time.ends_at>p_starts_at)
    order by (select count(*) from public.appointments a where a.staff_id=s.id and a.id is distinct from p_ignore_appointment_id
      and a.status in ('pending','confirmed','completed') and a.starts_at>=v_date::timestamp at time zone 'Asia/Hong_Kong'
      and a.starts_at<(v_date+1)::timestamp at time zone 'Asia/Hong_Kong'),s.sort_order,s.id;
end $$;

revoke all on function public.admin_create_staff(text,text,text,text,boolean,integer,bigint[]),
  public.admin_update_staff(bigint,text,text,text,text,boolean,integer,bigint[]),public.admin_delete_staff(bigint),
  public.admin_replace_staff_weekly_hours(bigint,jsonb),public.admin_create_staff_time_off(bigint,timestamptz,timestamptz,text,uuid),
  public.admin_delete_staff_time_off(bigint,bigint),public.admin_require_active_actor(uuid),public.admin_staff_snapshot(bigint),
  public.admin_create_staff_audited(uuid,text,text,text,text,boolean,integer,bigint[]),
  public.admin_update_staff_audited(uuid,bigint,text,text,text,text,boolean,integer,bigint[]),public.admin_delete_staff_audited(uuid,bigint),
  public.admin_replace_staff_weekly_hours_audited(uuid,bigint,jsonb),public.admin_create_staff_time_off_audited(uuid,bigint,timestamptz,timestamptz,text),
  public.admin_delete_staff_time_off_audited(uuid,bigint,bigint),public.booking_lock_active_staff(bigint),public.booking_enforce_active_staff() from public,anon,authenticated,service_role;
grant execute on function public.admin_assert_staff_payload(text,text,text,text,boolean,integer,bigint[]),public.admin_require_active_actor(uuid),
  public.admin_staff_snapshot(bigint),public.admin_create_staff_audited(uuid,text,text,text,text,boolean,integer,bigint[]),
  public.admin_update_staff_audited(uuid,bigint,text,text,text,text,boolean,integer,bigint[]),public.admin_delete_staff_audited(uuid,bigint),
  public.admin_replace_staff_weekly_hours_audited(uuid,bigint,jsonb),public.admin_create_staff_time_off_audited(uuid,bigint,timestamptz,timestamptz,text),
  public.admin_delete_staff_time_off_audited(uuid,bigint,bigint),public.booking_lock_active_staff(bigint),public.booking_enforce_active_staff() to service_role;
grant select, insert on public.admin_audit_logs to service_role;
grant usage on sequence public.admin_audit_logs_id_seq to service_role;

commit;
