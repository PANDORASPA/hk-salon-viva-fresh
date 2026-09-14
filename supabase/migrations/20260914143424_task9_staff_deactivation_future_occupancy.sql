-- Task 9 Fix Round 4: staff deactivation and booking writes share one
-- future-active predicate based on the final occupied range.
begin;

create or replace function public.booking_is_future_active_appointment(p_status text, p_occupied_until timestamptz)
returns boolean language sql stable security invoker set search_path = public, pg_temp as $$
  select p_status in ('pending','confirmed','completed') and p_occupied_until > now();
$$;

revoke all on function public.booking_is_future_active_appointment(text,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.booking_is_future_active_appointment(text,timestamptz) to service_role;

create or replace function public.booking_enforce_active_staff()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if public.booking_is_future_active_appointment(new.status, new.occupied_until)
    and not public.booking_lock_active_staff(new.staff_id) then
    raise exception 'staff_unavailable' using errcode='B0018';
  end if;
  return new;
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
  if not p_is_active and exists (
    select 1 from public.appointments
    where staff_id=p_staff_id
      and public.booking_is_future_active_appointment(status, occupied_until)
  ) then raise exception 'staff_has_future_appointments' using errcode='B0013'; end if;
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
  if exists (
    select 1 from public.appointments
    where staff_id=p_staff_id
      and public.booking_is_future_active_appointment(status, occupied_until)
  ) then raise exception 'staff_has_future_appointments' using errcode='B0013'; end if;
  if exists (select 1 from public.appointments where staff_id=p_staff_id) then raise exception 'staff_has_appointments' using errcode='B0014'; end if;
  delete from public.staff where id=p_staff_id;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,metadata)
    values(p_actor_id,p_actor_id,'staff.delete','staff',p_staff_id::text,'staff',p_staff_id::text,v_before,jsonb_build_object('before',v_before));
  return true;
end $$;

commit;
