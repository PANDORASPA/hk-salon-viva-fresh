begin;

create or replace function public.admin_save_package(
  p_actor_id uuid, p_package_id bigint, p_name text, p_colour_hex text, p_description text,
  p_total_sessions integer, p_validity_days integer, p_price_hkd integer, p_service_ids bigint[]
) returns public.packages language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before jsonb; v_after public.packages%rowtype; v_count integer;
begin
  perform public.admin_require_active_actor(p_actor_id);
  if length(trim(coalesce(p_name,''))) not between 2 and 160 or coalesce(p_colour_hex,'') !~ '^#[0-9a-fA-F]{6}$'
    or length(coalesce(p_description,'')) > 1200 or p_total_sessions not between 1 and 10000
    or p_validity_days not between 1 and 3650 or p_price_hkd is null or p_price_hkd < 0
    or coalesce(array_length(p_service_ids,1),0) < 1
    or exists(select 1 from unnest(coalesce(p_service_ids,'{}'::bigint[])) x where x < 1)
    or coalesce(array_length(p_service_ids,1),0) <> (select count(distinct x) from unnest(coalesce(p_service_ids,'{}'::bigint[])) x)
  then raise exception 'invalid_package_payload' using errcode='B0041'; end if;
  select count(*) into v_count from public.services where id=any(p_service_ids) and published;
  if v_count <> array_length(p_service_ids,1) then raise exception 'invalid_service_mapping' using errcode='B0042'; end if;
  if p_package_id is null then
    insert into public.packages(name,colour_hex,description,total_sessions,validity_days,price_hkd)
      values(trim(p_name),lower(p_colour_hex),nullif(trim(p_description),''),p_total_sessions,p_validity_days,p_price_hkd) returning * into v_after;
  else
    select to_jsonb(p) into v_before from public.packages p where id=p_package_id for update;
    if v_before is null then raise exception 'package_not_found' using errcode='B0043'; end if;
    update public.packages set name=trim(p_name),colour_hex=lower(p_colour_hex),description=nullif(trim(p_description),''),total_sessions=p_total_sessions,validity_days=p_validity_days,price_hkd=p_price_hkd where id=p_package_id returning * into v_after;
  end if;
  delete from public.package_services where package_id=v_after.id;
  insert into public.package_services(package_id,service_id) select v_after.id,x from unnest(p_service_ids) x;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,case when p_package_id is null then 'package.create' else 'package.update' end,'package',v_after.id::text,'packages',v_after.id::text,v_before,to_jsonb(v_after),jsonb_build_object('serviceIds',to_jsonb(p_service_ids)));
  return v_after;
end $$;
revoke all on function public.admin_save_package(uuid,bigint,text,text,text,integer,integer,integer,bigint[]) from public,anon,authenticated;
grant execute on function public.admin_save_package(uuid,bigint,text,text,text,integer,integer,integer,bigint[]) to service_role;

create or replace function public.admin_save_settings(p_actor_id uuid,p_data jsonb)
returns public.app_settings language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before jsonb; v_after public.app_settings%rowtype;
begin
  perform public.admin_require_active_actor(p_actor_id);
  if p_data is null or jsonb_typeof(p_data) <> 'object' or (select count(*) from jsonb_object_keys(p_data)) > 20 then raise exception 'invalid_settings' using errcode='B0044'; end if;
  select data into v_before from public.app_settings where id=1 for update;
  if not found then raise exception 'settings_not_found' using errcode='B0045'; end if;
  update public.app_settings set data=p_data,updated_by=p_actor_id,updated_at=now() where id=1 returning * into v_after;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data)
    values(p_actor_id,p_actor_id,'app-settings.update','app_settings','1','app_settings','1',v_before,v_after.data);
  return v_after;
end $$;

create or replace function public.admin_save_site_content(p_actor_id uuid,p_data jsonb)
returns public.site_content language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before jsonb; v_after public.site_content%rowtype;
begin
  perform public.admin_require_active_actor(p_actor_id);
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text)>50000 then raise exception 'invalid_site_content' using errcode='B0046'; end if;
  select data into v_before from public.site_content where id=1 for update;
  if not found then raise exception 'site_content_not_found' using errcode='B0047'; end if;
  update public.site_content set data=p_data,updated_by=p_actor_id where id=1 returning * into v_after;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data)
    values(p_actor_id,p_actor_id,'site-content.update','site_content','1','site_content','1',v_before,v_after.data);
  return v_after;
end $$;

create or replace function public.admin_set_administrator(p_actor_id uuid,p_target_id uuid,p_is_active boolean)
returns public.admin_users language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before public.admin_users%rowtype; v_after public.admin_users%rowtype;
begin
  perform public.admin_require_active_actor(p_actor_id);
  select * into v_before from public.admin_users where user_id=p_target_id for update;
  if not found then raise exception 'administrator_not_found' using errcode='B0048'; end if;
  if not p_is_active and v_before.is_active and (select count(*) from public.admin_users where is_active) <= 1 then raise exception 'final_active_admin' using errcode='B0049'; end if;
  update public.admin_users set is_active=p_is_active where user_id=p_target_id returning * into v_after;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data)
    values(p_actor_id,p_actor_id,'administrator.update','admin_users',p_target_id::text,'admin_users',p_target_id::text,to_jsonb(v_before),to_jsonb(v_after));
  return v_after;
end $$;

revoke all on function public.admin_save_settings(uuid,jsonb),public.admin_save_site_content(uuid,jsonb),public.admin_set_administrator(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_save_settings(uuid,jsonb),public.admin_save_site_content(uuid,jsonb),public.admin_set_administrator(uuid,uuid,boolean) to service_role;

commit;
