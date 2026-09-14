-- Task 10 Fix Round 1: admin booking mutations and their audit records are one transaction.
begin;

create or replace function public.admin_create_appointment_audited(
  p_actor_id uuid, p_service_id bigint, p_starts_at timestamptz, p_staff_preference text,
  p_customer_name text, p_customer_phone text, p_customer_email text, p_customer_id bigint,
  p_customer_package_id bigint, p_confirmation_token_hash text, p_customer_notes text default null
) returns public.appointments language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_created public.appointments%rowtype;
begin
  perform public.admin_require_active_actor(p_actor_id);
  select * into v_created from public.create_appointment_v2(p_service_id,p_starts_at,p_staff_preference,p_customer_name,p_customer_phone,p_customer_email,p_customer_id,p_actor_id,p_customer_package_id,'admin',p_confirmation_token_hash,p_customer_notes);
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,after_data,metadata)
    values(p_actor_id,p_actor_id,'appointment.create','appointment',v_created.id::text,'appointments',v_created.id::text,
      jsonb_build_object('id',v_created.id,'status',v_created.status,'startsAt',v_created.starts_at,'staffId',v_created.staff_id),
      jsonb_build_object('source','admin','serviceId',p_service_id,'customerId',p_customer_id));
  return v_created;
end $$;

create or replace function public.admin_reschedule_appointment_audited(
  p_actor_id uuid, p_appointment_id bigint, p_starts_at timestamptz, p_staff_preference text
) returns public.appointments language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_before public.appointments%rowtype; v_after public.appointments%rowtype;
begin
  perform public.admin_require_active_actor(p_actor_id);
  select * into v_before from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'booking_not_found' using errcode='B0008'; end if;
  select * into v_after from public.reschedule_appointment_v2(p_appointment_id,p_starts_at,p_staff_preference,p_actor_id);
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,'appointment.reschedule','appointment',v_after.id::text,'appointments',v_after.id::text,
      jsonb_build_object('startsAt',v_before.starts_at,'staffId',v_before.staff_id),jsonb_build_object('startsAt',v_after.starts_at,'staffId',v_after.staff_id),jsonb_build_object('source','admin'));
  return v_after;
end $$;

create or replace function public.admin_cancel_appointment_audited(p_actor_id uuid, p_appointment_id bigint)
returns public.appointments language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_before public.appointments%rowtype; v_after public.appointments%rowtype; v_refunded boolean;
begin
  perform public.admin_require_active_actor(p_actor_id);
  select * into v_before from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'booking_not_found' using errcode='B0008'; end if;
  select * into v_after from public.cancel_appointment_v2(p_appointment_id,p_actor_id);
  select exists(select 1 from public.package_redemptions where appointment_id=p_appointment_id and refunded_at is not null) into v_refunded;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,'appointment.cancel','appointment',v_after.id::text,'appointments',v_after.id::text,
      jsonb_build_object('status',v_before.status),jsonb_build_object('status',v_after.status,'cancelledAt',v_after.cancelled_at),jsonb_build_object('packageRefunded',v_refunded));
  return v_after;
end $$;

create or replace function public.admin_set_appointment_status_audited(p_actor_id uuid, p_appointment_id bigint, p_status text, p_admin_notes text)
returns public.appointments language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_before public.appointments%rowtype; v_after public.appointments%rowtype;
begin
  perform public.admin_require_active_actor(p_actor_id);
  select * into v_before from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'booking_not_found' using errcode='B0008'; end if;
  if (v_before.status='pending' and p_status not in ('confirmed','no_show'))
    or (v_before.status='confirmed' and p_status not in ('completed','no_show'))
    or length(coalesce(p_admin_notes,'')) > 2000 then raise exception 'booking_not_changeable' using errcode='B0009'; end if;
  update public.appointments set status=p_status,admin_notes=nullif(trim(p_admin_notes),'') where id=p_appointment_id returning * into v_after;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,'appointment.status','appointment',v_after.id::text,'appointments',v_after.id::text,jsonb_build_object('status',v_before.status),jsonb_build_object('status',v_after.status),jsonb_build_object('status',p_status));
  return v_after;
end $$;

revoke all on function public.admin_create_appointment_audited(uuid,bigint,timestamptz,text,text,text,text,bigint,bigint,text,text), public.admin_reschedule_appointment_audited(uuid,bigint,timestamptz,text), public.admin_cancel_appointment_audited(uuid,bigint), public.admin_set_appointment_status_audited(uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.admin_create_appointment_audited(uuid,bigint,timestamptz,text,text,text,text,bigint,bigint,text,text), public.admin_reschedule_appointment_audited(uuid,bigint,timestamptz,text), public.admin_cancel_appointment_audited(uuid,bigint), public.admin_set_appointment_status_audited(uuid,bigint,text,text) to service_role;
commit;
