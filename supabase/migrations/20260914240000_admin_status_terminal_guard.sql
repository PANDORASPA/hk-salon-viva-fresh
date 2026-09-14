begin;

-- Terminal rows are immutable. Pending may confirm/no-show; confirmed may
-- complete/no-show; cancellation is always routed through the refund command.
create or replace function public.admin_set_appointment_status_audited(p_actor_id uuid, p_appointment_id bigint, p_status text, p_admin_notes text)
returns public.appointments language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_before public.appointments%rowtype; v_after public.appointments%rowtype;
begin
  perform public.admin_require_active_actor(p_actor_id);
  select * into v_before from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'booking_not_found' using errcode='B0008'; end if;
  if v_before.status in ('cancelled','completed','no_show')
    or (v_before.status='pending' and p_status not in ('confirmed','no_show'))
    or (v_before.status='confirmed' and p_status not in ('completed','no_show'))
    or length(coalesce(p_admin_notes,'')) > 2000 then raise exception 'booking_not_changeable' using errcode='B0009'; end if;
  update public.appointments set status=p_status,admin_notes=nullif(trim(p_admin_notes),'') where id=p_appointment_id returning * into v_after;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,'appointment.status','appointment',v_after.id::text,'appointments',v_after.id::text,jsonb_build_object('status',v_before.status),jsonb_build_object('status',v_after.status),jsonb_build_object('status',p_status));
  return v_after;
end $$;

revoke all on function public.admin_set_appointment_status_audited(uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.admin_set_appointment_status_audited(uuid,bigint,text,text) to service_role;
commit;
