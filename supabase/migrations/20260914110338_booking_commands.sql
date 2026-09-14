-- All commands are single PostgreSQL transactions. The server alone may call
-- them and supplies an actor obtained from verified auth, never request JSON.
begin;

-- Explicit privileges support both old automatic-grant projects and new ones.
-- Invoker functions avoid creating a second RLS-bypassing privilege boundary.
grant select on public.services, public.business_hours, public.blocked_dates,
  public.app_settings, public.customers, public.packages, public.package_services,
  public.admin_users to service_role;
-- PostgreSQL SELECT ... FOR SHARE also requires an UPDATE privilege. Grant a
-- single column solely to permit the row locks used by these invoker helpers.
grant update(id) on public.services, public.app_settings to service_role;
grant update(weekday) on public.business_hours to service_role;
grant select, insert, update on public.appointments, public.customer_packages,
  public.package_redemptions to service_role;
grant usage on sequence public.appointments_id_seq, public.package_redemptions_id_seq to service_role;

-- This deliberately works before Task 6 adds customers.user_id: a missing key
-- is NULL and cannot establish ownership. No phone/email matching grants access.
create or replace function public.booking_customer_owner(p_customer_id bigint)
returns uuid language sql stable security invoker set search_path = '' as $$
  select nullif(to_jsonb(c)->>'user_id', '')::uuid
  from public.customers c where c.id = p_customer_id;
$$;

create or replace function public.booking_assert_actor(p_appointment public.appointments, p_actor_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_actor_id is null then raise exception 'authentication_required' using errcode='B0001'; end if;
  if p_appointment.user_id is distinct from p_actor_id
    and public.booking_customer_owner(p_appointment.customer_id) is distinct from p_actor_id
    and not exists (select 1 from public.admin_users where user_id=p_actor_id and is_active) then
    raise exception 'ownership_forbidden' using errcode='B0003';
  end if;
end $$;

create or replace function public.booking_slot_candidates(
  p_service_id bigint, p_starts_at timestamptz, p_staff_preference text,
  p_ignore_appointment_id bigint default null
) returns table(staff_id bigint, ends_at timestamptz, buffer_minutes integer)
language plpgsql security invoker set search_path = '' as $$
declare
  v_service public.services%rowtype;
  v_settings jsonb;
  v_hours public.business_hours%rowtype;
  v_date date;
  v_local timestamp;
  v_end timestamptz;
  v_occupied timestamptz;
  v_buffer integer;
  v_step numeric;
  v_lead numeric;
  v_horizon numeric;
begin
  select * into v_service from public.services where id=p_service_id and enabled and published for share;
  if not found then raise exception 'service_unavailable' using errcode='B0004'; end if;
  select data into v_settings from public.app_settings where id=1 for share;
  begin
    v_buffer := coalesce(v_settings->>'booking_buffer_minutes', v_settings->>'buffer_minutes', v_settings->>'bufferMinutes', '15')::integer;
    v_step := coalesce(v_settings->>'slot_step_minutes', v_settings->>'step_minutes', v_settings->>'stepMinutes', '30')::numeric;
    v_lead := greatest(0, coalesce(v_settings->>'minimum_lead_minutes', v_settings->>'minimumLeadMinutes', '120')::numeric);
    v_horizon := greatest(0, coalesce(v_settings->>'maximum_advance_days', v_settings->>'maximumAdvanceDays', '90')::numeric);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'booking_window_invalid' using errcode='B0005';
  end;
  if v_buffer not between 0 and 120 or v_step <= 0 or v_step > 1440
    or v_step::text in ('NaN','Infinity','-Infinity')
    or v_lead::text in ('NaN','Infinity','-Infinity')
    or v_horizon::text in ('NaN','Infinity','-Infinity')
    or p_starts_at is null or not isfinite(p_starts_at)
    or p_starts_at < now() + v_lead * interval '1 minute'
    or p_starts_at > now() + v_horizon * interval '1 day' then
    raise exception 'booking_window_invalid' using errcode='B0005';
  end if;
  if p_staff_preference is null or (p_staff_preference <> 'any' and p_staff_preference !~ '^[1-9][0-9]*$') then
    raise exception 'validation_error' using errcode='B0006';
  end if;
  v_local := p_starts_at at time zone 'Asia/Hong_Kong';
  v_date := v_local::date;
  v_end := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_occupied := v_end + make_interval(mins => v_buffer);
  select * into v_hours from public.business_hours where weekday=extract(dow from v_date) for share;
  if not found or not v_hours.is_open or exists (
    select 1 from public.blocked_dates where starts_on <= v_date and ends_on >= v_date
  ) then return; end if;

  -- Deliberately do not prefilter appointment collisions: the exclusion
  -- constraint is the authoritative last check, including concurrent inserts.
  -- Counting active bookings on this HK day balances the day's workload.
  return query
    select s.id, v_end, v_buffer
    from public.staff s
    join public.staff_services skill on skill.staff_id=s.id and skill.service_id=p_service_id
    join public.staff_weekly_hours h on h.staff_id=s.id and h.weekday=extract(dow from v_date)
    where s.is_active and h.is_working
      and (p_staff_preference='any' or s.id::text=p_staff_preference)
      and v_local >= v_date + greatest(v_hours.opens_at, h.starts_at)
      and (v_occupied at time zone 'Asia/Hong_Kong') <= v_date + least(v_hours.closes_at, h.ends_at)
      and mod(extract(epoch from (v_local - (v_date + greatest(v_hours.opens_at, h.starts_at)))), v_step * 60)=0
      and not exists (select 1 from public.staff_time_off off_time where off_time.staff_id=s.id
        and off_time.starts_at < v_occupied and off_time.ends_at > p_starts_at)
    order by (select count(*) from public.appointments a where a.staff_id=s.id
      and a.id is distinct from p_ignore_appointment_id
      and a.status in ('pending','confirmed','completed')
      and a.starts_at >= v_date::timestamp at time zone 'Asia/Hong_Kong'
      and a.starts_at < (v_date+1)::timestamp at time zone 'Asia/Hong_Kong'), s.sort_order, s.id;
end $$;

create or replace function public.booking_lock_package(
  p_customer_package_id bigint, p_customer_id bigint, p_service_id bigint,
  p_starts_at timestamptz, p_existing_appointment_id bigint default null
) returns public.customer_packages language plpgsql security invoker set search_path = '' as $$
declare v_package public.customer_packages%rowtype;
begin
  select * into v_package from public.customer_packages where id=p_customer_package_id for update;
  if not found then raise exception 'package_not_usable' using errcode='B0007'; end if;
  if v_package.customer_id is distinct from p_customer_id then
    raise exception 'ownership_forbidden' using errcode='B0003';
  end if;
  if v_package.is_active is not true or v_package.expires_at <= greatest(now(), p_starts_at)
    or not exists (select 1 from public.packages p join public.package_services ps on ps.package_id=p.id
      where p.id=v_package.package_id and p.is_active and ps.service_id=p_service_id)
    or (p_existing_appointment_id is null and v_package.sessions_remaining < 1)
    or (p_existing_appointment_id is not null and not exists (
      select 1 from public.package_redemptions r where r.appointment_id=p_existing_appointment_id
        and r.customer_package_id=v_package.id and r.refunded_at is null
    )) then raise exception 'package_not_usable' using errcode='B0007'; end if;
  return v_package;
end $$;

create or replace function public.create_appointment_v2(
  p_service_id bigint, p_starts_at timestamptz, p_staff_preference text,
  p_customer_name text, p_customer_phone text, p_customer_email text,
  p_customer_id bigint, p_actor_id uuid, p_customer_package_id bigint,
  p_source text, p_confirmation_token_hash text, p_customer_notes text default null
) returns public.appointments language plpgsql security invoker set search_path = '' as $$
declare
  v_created public.appointments%rowtype;
  v_candidate record;
  v_user_id uuid;
  v_admin boolean;
begin
  if p_source is null or p_source not in ('web','account','admin')
    or p_confirmation_token_hash is null or p_confirmation_token_hash !~ '^[0-9a-f]{64}$'
    or p_customer_name is null or length(trim(p_customer_name)) not between 2 and 120
    or p_customer_phone is null or length(trim(p_customer_phone)) not between 7 and 30
    or length(coalesce(p_customer_notes,'')) > 2000 then
    raise exception 'validation_error' using errcode='B0006';
  end if;
  if (p_source in ('account','admin') or p_customer_id is not null or p_customer_package_id is not null) and p_actor_id is null then
    raise exception 'authentication_required' using errcode='B0001';
  end if;
  v_admin := p_source='admin' and exists (select 1 from public.admin_users where user_id=p_actor_id and is_active);
  if p_source='admin' and not v_admin then raise exception 'ownership_forbidden' using errcode='B0003'; end if;
  v_user_id := case when v_admin then public.booking_customer_owner(p_customer_id) else p_actor_id end;
  if p_customer_id is not null and (not exists (select 1 from public.customers where id=p_customer_id)
    or (not v_admin and public.booking_customer_owner(p_customer_id) is distinct from p_actor_id)) then
    raise exception 'ownership_forbidden' using errcode='B0003';
  end if;
  if p_customer_package_id is not null then
    if p_customer_id is null then raise exception 'ownership_forbidden' using errcode='B0003'; end if;
    perform public.booking_lock_package(p_customer_package_id, p_customer_id, p_service_id, p_starts_at);
  end if;

  for v_candidate in select * from public.booking_slot_candidates(p_service_id,p_starts_at,p_staff_preference) loop
    -- Each attempted insert owns its subtransaction. A conflict rolls back
    -- only that attempt; the next eligible staff member is still tried.
    begin
      insert into public.appointments(user_id,service_id,staff_id,customer_id,customer_package_id,
        customer_name,customer_phone,customer_email,starts_at,ends_at,buffer_minutes,
        source,confirmation_token_hash,customer_notes,status)
      values(v_user_id,p_service_id,v_candidate.staff_id,p_customer_id,p_customer_package_id,
        trim(p_customer_name),trim(p_customer_phone),nullif(trim(p_customer_email),''),p_starts_at,
        v_candidate.ends_at,v_candidate.buffer_minutes,p_source,p_confirmation_token_hash,
        nullif(trim(p_customer_notes),''),'pending') returning * into v_created;
    exception when exclusion_violation then
      continue;
    end;
    -- A redemption failure is outside the candidate recovery block and must
    -- abort the entire command, including the successful appointment insert.
    if p_customer_package_id is not null then
      update public.customer_packages set sessions_remaining=sessions_remaining-1 where id=p_customer_package_id;
      insert into public.package_redemptions(customer_package_id,appointment_id)
        values(p_customer_package_id,v_created.id);
    end if;
    return v_created;
  end loop;
  raise exception 'slot_unavailable' using errcode='B0002';
end $$;

create or replace function public.reschedule_appointment_v2(
  p_appointment_id bigint, p_starts_at timestamptz, p_staff_preference text,
  p_actor_id uuid default auth.uid()
) returns public.appointments language plpgsql security invoker set search_path = '' as $$
declare v_existing public.appointments%rowtype; v_updated public.appointments%rowtype; v_candidate record;
begin
  select * into v_existing from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'booking_not_found' using errcode='B0008'; end if;
  perform public.booking_assert_actor(v_existing,p_actor_id);
  if v_existing.status not in ('pending','confirmed') or v_existing.starts_at <= now() then
    raise exception 'booking_not_changeable' using errcode='B0009';
  end if;
  if v_existing.customer_package_id is not null then
    perform public.booking_lock_package(v_existing.customer_package_id,v_existing.customer_id,v_existing.service_id,p_starts_at,v_existing.id);
  end if;
  for v_candidate in select * from public.booking_slot_candidates(v_existing.service_id,p_starts_at,p_staff_preference,v_existing.id) loop
    begin
      -- One UPDATE retains the old version until commit. PostgreSQL validates
      -- the new exclusion range before success; failed attempts restore the old
      -- row. There is no delete/reinsert or released-occupancy interval.
      update public.appointments set starts_at=p_starts_at,ends_at=v_candidate.ends_at,
        staff_id=v_candidate.staff_id,buffer_minutes=v_candidate.buffer_minutes
        where id=v_existing.id returning * into v_updated;
    exception when exclusion_violation then
      continue;
    end;
    -- The original redemption pays for this same appointment; do not refund
    -- and re-debit it when the slot changes.
    return v_updated;
  end loop;
  raise exception 'slot_unavailable' using errcode='B0002';
end $$;

-- Legacy server callers share the retained-refund ledger. Deleting a refunded
-- row would permit a stale retry to credit a session again after another use.
create or replace function public.refund_customer_package(p_customer_package_id bigint,p_appointment_id bigint)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_refunded bigint;
begin
  perform 1 from public.customer_packages where id=p_customer_package_id for update;
  if not found then raise exception 'package_not_usable' using errcode='B0007'; end if;
  update public.package_redemptions set refunded_at=now()
    where appointment_id=p_appointment_id and customer_package_id=p_customer_package_id and refunded_at is null
    returning id into v_refunded;
  if v_refunded is not null then
    update public.customer_packages set sessions_remaining=least(total_sessions,sessions_remaining+1)
      where id=p_customer_package_id;
  end if;
end $$;

create or replace function public.cancel_appointment_v2(p_appointment_id bigint,p_actor_id uuid)
returns public.appointments language plpgsql security invoker set search_path = '' as $$
declare
  v_existing public.appointments%rowtype;
  v_updated public.appointments%rowtype;
  v_cutoff numeric;
begin
  select * into v_existing from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'booking_not_found' using errcode='B0008'; end if;
  perform public.booking_assert_actor(v_existing,p_actor_id);
  if v_existing.status='cancelled' then return v_existing; end if;
  if v_existing.status not in ('pending','confirmed') then raise exception 'booking_not_changeable' using errcode='B0009'; end if;
  select greatest(0, coalesce(data->>'cancel_cutoff_hours','24')::numeric) into v_cutoff from public.app_settings where id=1 for share;
  if v_existing.starts_at < now() + coalesce(v_cutoff,24) * interval '1 hour'
    and not exists (select 1 from public.admin_users where user_id=p_actor_id and is_active) then
    raise exception 'late_cancellation' using errcode='B0010', detail=jsonb_build_object(
      'cutoffHours',coalesce(v_cutoff,24),
      'hoursUntilStart',greatest(0,round(extract(epoch from (v_existing.starts_at-now()))/3600,1))
    )::text;
  end if;
  if v_existing.customer_package_id is not null then
    perform public.refund_customer_package(v_existing.customer_package_id,v_existing.id);
  end if;
  update public.appointments set status='cancelled',cancelled_at=now(),cancelled_by=p_actor_id
    where id=v_existing.id returning * into v_updated;
  return v_updated;
end $$;

revoke all on function public.booking_customer_owner(bigint),
  public.booking_assert_actor(public.appointments,uuid),
  public.booking_slot_candidates(bigint,timestamptz,text,bigint),
  public.booking_lock_package(bigint,bigint,bigint,timestamptz,bigint),
  public.create_appointment_v2(bigint,timestamptz,text,text,text,text,bigint,uuid,bigint,text,text,text),
  public.reschedule_appointment_v2(bigint,timestamptz,text,uuid),
  public.cancel_appointment_v2(bigint,uuid) from public,anon,authenticated;
revoke all on function public.refund_customer_package(bigint,bigint),
  public.redeem_customer_package(bigint,bigint),public.deduct_package_session(bigint,bigint)
  from public,anon,authenticated;
grant execute on function public.booking_customer_owner(bigint),
  public.booking_assert_actor(public.appointments,uuid),
  public.booking_slot_candidates(bigint,timestamptz,text,bigint),
  public.booking_lock_package(bigint,bigint,bigint,timestamptz,bigint),
  public.create_appointment_v2(bigint,timestamptz,text,text,text,text,bigint,uuid,bigint,text,text,text),
  public.reschedule_appointment_v2(bigint,timestamptz,text,uuid),
  public.cancel_appointment_v2(bigint,uuid) to service_role;
grant execute on function public.refund_customer_package(bigint,bigint) to service_role;

commit;
