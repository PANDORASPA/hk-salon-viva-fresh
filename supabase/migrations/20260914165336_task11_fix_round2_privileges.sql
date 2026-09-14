begin;

-- SECURITY INVOKER commands run as service_role: grants are intentionally
-- narrow and browser roles get no mutation privilege even if an old RLS
-- policy remains present.
revoke insert, update, delete on public.services, public.packages, public.package_services,
  public.staff_services, public.customer_packages, public.app_settings, public.site_content,
  public.admin_users, public.admin_audit_logs from public, anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
grant execute on function public.is_salon_admin() to authenticated;
grant select, insert, update, delete on public.services, public.packages, public.package_services,
  public.staff_services, public.customer_packages, public.app_settings, public.site_content,
  public.admin_users, public.admin_audit_logs to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.admin_grant_administrator(p_actor_id uuid,p_target_id uuid)
returns public.admin_users language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before jsonb; v_after public.admin_users%rowtype;
begin
  perform pg_advisory_xact_lock(6201101);
  perform public.admin_require_active_actor(p_actor_id);
  select to_jsonb(a) into v_before from public.admin_users a where user_id=p_target_id for update;
  insert into public.admin_users(user_id,is_active,created_by) values(p_target_id,true,p_actor_id)
    on conflict(user_id) do update set is_active=true returning * into v_after;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data)
    values(p_actor_id,p_actor_id,'administrator.grant','admin_users',p_target_id::text,'admin_users',p_target_id::text,v_before,to_jsonb(v_after));
  return v_after;
end $$;

create or replace function public.admin_set_administrator(p_actor_id uuid,p_target_id uuid,p_is_active boolean)
returns public.admin_users language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before public.admin_users%rowtype; v_after public.admin_users%rowtype;
begin
  perform pg_advisory_xact_lock(6201101);
  perform public.admin_require_active_actor(p_actor_id);
  select * into v_before from public.admin_users where user_id=p_target_id for update;
  if not found then raise exception 'administrator_not_found' using errcode='B0048'; end if;
  if not p_is_active and v_before.is_active and (select count(*) from public.admin_users where is_active) <= 1 then raise exception 'final_active_admin' using errcode='B0049'; end if;
  update public.admin_users set is_active=p_is_active where user_id=p_target_id returning * into v_after;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data)
    values(p_actor_id,p_actor_id,'administrator.update','admin_users',p_target_id::text,'admin_users',p_target_id::text,to_jsonb(v_before),to_jsonb(v_after));
  return v_after;
end $$;
revoke all on function public.admin_grant_administrator(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_grant_administrator(uuid,uuid) to service_role;

commit;
