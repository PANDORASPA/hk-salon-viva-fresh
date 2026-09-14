begin;

-- Package balances are financial/entitlement records.  This is deliberately
-- one command so a balance write can never succeed without its audit row.
create or replace function public.admin_adjust_customer_package(
  p_actor_id uuid, p_customer_package_id bigint, p_delta integer, p_reason text
) returns public.customer_packages language plpgsql security invoker
set search_path = public, pg_temp as $$
declare v_before public.customer_packages%rowtype; v_after public.customer_packages%rowtype;
begin
  perform public.admin_require_active_actor(p_actor_id);
  if p_delta is null or p_delta = 0 or length(trim(coalesce(p_reason,''))) not between 1 and 500 then
    raise exception 'reason_required' using errcode='B0031';
  end if;
  select * into v_before from public.customer_packages where id=p_customer_package_id for update;
  if not found then raise exception 'customer_package_not_found' using errcode='B0032'; end if;
  if v_before.sessions_remaining + p_delta < 0 or v_before.sessions_remaining + p_delta > v_before.total_sessions then
    raise exception 'balance_out_of_range' using errcode='B0033';
  end if;
  update public.customer_packages set sessions_remaining=sessions_remaining+p_delta
    where id=p_customer_package_id returning * into v_after;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,'customer_package.adjust','customer_package',v_after.id::text,'customer_packages',v_after.id::text,
      jsonb_build_object('sessionsRemaining',v_before.sessions_remaining,'totalSessions',v_before.total_sessions),
      jsonb_build_object('sessionsRemaining',v_after.sessions_remaining,'totalSessions',v_after.total_sessions),
      jsonb_build_object('reason',trim(p_reason),'delta',p_delta));
  return v_after;
end $$;

revoke all on function public.admin_adjust_customer_package(uuid,bigint,integer,text) from public, anon, authenticated;
grant execute on function public.admin_adjust_customer_package(uuid,bigint,integer,text) to service_role;

create or replace function public.admin_save_service(
  p_actor_id uuid, p_service_id bigint, p_name text, p_price integer, p_duration integer, p_category text,
  p_description text, p_published boolean, p_sort_order integer, p_staff_ids bigint[]
) returns public.services language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before jsonb; v_after public.services%rowtype; v_count integer;
begin
  perform public.admin_require_active_actor(p_actor_id);
  if length(trim(coalesce(p_name,''))) not between 2 and 160 or p_price is null or p_price < 0 or p_duration not between 15 and 480
    or length(trim(coalesce(p_category,''))) not between 1 and 80 or length(coalesce(p_description,'')) > 1200
    or p_published is null or p_sort_order not between -100000 and 100000
    or exists(select 1 from unnest(coalesce(p_staff_ids,'{}'::bigint[])) x where x < 1)
    or coalesce(array_length(p_staff_ids,1),0) <> (select count(distinct x) from unnest(coalesce(p_staff_ids,'{}'::bigint[])) x)
  then raise exception 'invalid_service_payload' using errcode='B0034'; end if;
  select count(*) into v_count from public.staff where id=any(coalesce(p_staff_ids,'{}'::bigint[])) and is_active;
  if v_count <> coalesce(array_length(p_staff_ids,1),0) then raise exception 'invalid_staff_mapping' using errcode='B0035'; end if;
  if p_service_id is null then
    insert into public.services(name,price,time,duration_minutes,category,description,enabled,published,sort_order)
      values(trim(p_name),p_price,p_duration,p_duration,trim(p_category),nullif(trim(p_description),''),p_published,p_published,p_sort_order) returning * into v_after;
  else
    select to_jsonb(s) into v_before from public.services s where id=p_service_id for update;
    if v_before is null then raise exception 'service_not_found' using errcode='B0036'; end if;
    update public.services set name=trim(p_name),price=p_price,time=p_duration,duration_minutes=p_duration,category=trim(p_category),description=nullif(trim(p_description),''),enabled=p_published,published=p_published,sort_order=p_sort_order,updated_at=now() where id=p_service_id returning * into v_after;
  end if;
  delete from public.staff_services where service_id=v_after.id;
  insert into public.staff_services(staff_id,service_id) select x,v_after.id from unnest(coalesce(p_staff_ids,'{}'::bigint[])) x;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,case when p_service_id is null then 'service.create' else 'service.update' end,'service',v_after.id::text,'services',v_after.id::text,v_before,to_jsonb(v_after),jsonb_build_object('staffIds',coalesce(to_jsonb(p_staff_ids),'[]'::jsonb)));
  return v_after;
end $$;
revoke all on function public.admin_save_service(uuid,bigint,text,integer,integer,text,text,boolean,integer,bigint[]) from public,anon,authenticated;
grant execute on function public.admin_save_service(uuid,bigint,text,integer,integer,text,text,boolean,integer,bigint[]) to service_role;

commit;
