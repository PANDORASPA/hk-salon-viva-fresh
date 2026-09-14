begin;
create or replace function public.admin_users_last_active_guard()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  -- The same xact lock is acquired by audited grant/update commands. PostgreSQL
  -- permits reentrant transaction locks, so the trigger also protects direct
  -- service-role writes without changing RPC ordering.
  perform pg_advisory_xact_lock(6201101);
  if ((tg_op='DELETE' and old.is_active) or (tg_op='UPDATE' and old.is_active and not new.is_active))
    and (select count(*) from public.admin_users where is_active) <= 1 then
    raise exception 'final_active_admin' using errcode='B0049';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists admin_users_last_active_guard on public.admin_users;
create trigger admin_users_last_active_guard before update or delete on public.admin_users
  for each row execute function public.admin_users_last_active_guard();
revoke all on function public.admin_users_last_active_guard() from public,anon,authenticated;
grant execute on function public.admin_users_last_active_guard() to service_role;
commit;
