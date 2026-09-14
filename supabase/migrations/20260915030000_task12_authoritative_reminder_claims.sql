-- Reminder claims are bound to the locked authoritative appointment instant.
-- Ambiguous stale sends are never retried after Resend's 24-hour key window.
begin;

create or replace function public.claim_reminder_notification(
  p_booking_id bigint, p_event text, p_reminder_window_hours integer, p_customer_name text,
  p_customer_email text, p_starts_at timestamptz, p_email_subject text, p_email_body text
) returns table(notification_id bigint, claimed boolean, claim_token uuid, attempt integer)
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_row public.notifications%rowtype;
  v_appointment public.appointments%rowtype;
  v_token uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_window_start timestamptz;
begin
  if p_booking_id is null or p_event <> 'reminder' or p_reminder_window_hours not between 1 and 168 then
    raise exception 'invalid_reminder_claim' using errcode = 'B0050';
  end if;

  select * into v_appointment from public.appointments
    where id=p_booking_id and status in ('pending','confirmed') for share;
  if not found or v_appointment.starts_at <= v_now then
    return query select null::bigint,false,null::uuid,0; return;
  end if;
  -- Scheduler values cross the JSON/SQL boundary as ISO instants. One second
  -- admits harmless precision truncation but rejects a changed booking slot.
  if p_starts_at is null or abs(extract(epoch from (v_appointment.starts_at-p_starts_at))) > 1 then
    return query select null::bigint,false,null::uuid,0; return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_booking_id::text || ':' || p_event || ':' || p_reminder_window_hours::text, 0));
  select * into v_row from public.notifications where booking_id=p_booking_id and event=p_event and reminder_window_hours=p_reminder_window_hours for update;
  if not found then
    v_window_start := v_now + make_interval(hours => p_reminder_window_hours);
    if v_appointment.starts_at < v_window_start or v_appointment.starts_at >= v_window_start + interval '1 hour' then
      return query select null::bigint,false,null::uuid,0; return;
    end if;
    insert into public.notifications(event,booking_id,customer_name,customer_email,starts_at,email_subject,email_body,reminder_window_hours,reminder_claim_token,reminder_lease_expires_at,reminder_attempt,channel_results)
    values(p_event,p_booking_id,nullif(trim(p_customer_name),''),nullif(trim(p_customer_email),''),v_appointment.starts_at,p_email_subject,p_email_body,p_reminder_window_hours,v_token,v_now+interval '5 minutes',1,
      jsonb_build_object('email',jsonb_build_object('ok',false,'status','persistence_pending','reason','delivery_pending')))
    returning * into v_row;
    return query select v_row.id,true,v_token,1; return;
  end if;

  if v_row.starts_at is null or abs(extract(epoch from (v_row.starts_at-v_appointment.starts_at))) > 1 then
    update public.notifications set channel_results=jsonb_build_object('email',jsonb_build_object('ok',false,'status','reconciliation_required','reason','appointment_time_changed')), reminder_lease_expires_at=null where id=v_row.id;
    return query select v_row.id,false,null::uuid,v_row.reminder_attempt; return;
  end if;
  if v_appointment.starts_at >= v_now + make_interval(hours => p_reminder_window_hours) then
    return query select v_row.id,false,null::uuid,v_row.reminder_attempt; return;
  end if;
  if coalesce(v_row.channel_results->'email'->>'status','') in ('sent','disabled','dry_run','reconciliation_required') or v_row.reminder_attempt >= 5 then
    return query select v_row.id,false,null::uuid,v_row.reminder_attempt; return;
  end if;
  if v_row.channel_results->'email'->>'status'='failed'
    and coalesce(v_row.channel_results->'email'->>'reason','') not in ('no_recipient','missing_content','sender_not_configured') then
    return query select v_row.id,false,null::uuid,v_row.reminder_attempt; return;
  end if;
  if v_row.channel_results->'email'->>'status'='persistence_pending' then
    if v_row.reminder_lease_expires_at > v_now then
      return query select v_row.id,false,null::uuid,v_row.reminder_attempt; return;
    end if;
    if v_row.delivered_at <= v_now-interval '24 hours' then
      update public.notifications set channel_results=jsonb_build_object('email',jsonb_build_object('ok',false,'status','reconciliation_required','reason','provider_delivery_unknown')), reminder_lease_expires_at=null where id=v_row.id;
      return query select v_row.id,false,null::uuid,v_row.reminder_attempt; return;
    end if;
  end if;
  update public.notifications set reminder_claim_token=v_token,reminder_lease_expires_at=v_now+interval '5 minutes',reminder_attempt=reminder_attempt+1,
    channel_results=jsonb_build_object('email',jsonb_build_object('ok',false,'status','persistence_pending','reason','retry_pending')) where id=v_row.id;
  return query select v_row.id,true,v_token,v_row.reminder_attempt+1;
end;
$$;

create or replace function public.find_retryable_reminder_appointments(
  p_reminder_window_hours integer, p_now timestamptz, p_limit integer default 50
) returns table(id bigint, starts_at timestamptz, status text, customer_name text, customer_email text, customer_phone text, service_name text)
language sql stable security invoker set search_path = public, pg_temp as $$
  select a.id, a.starts_at, a.status, a.customer_name, a.customer_email, a.customer_phone, s.name
  from public.notifications n
  join public.appointments a on a.id=n.booking_id
  left join public.services s on s.id=a.service_id
  where n.event='reminder'
    and n.reminder_window_hours=p_reminder_window_hours
    and a.status in ('pending','confirmed')
    and a.starts_at > p_now
    and a.starts_at < p_now + make_interval(hours => p_reminder_window_hours)
    and abs(extract(epoch from (n.starts_at-a.starts_at))) <= 1
    and n.reminder_attempt < 5
    and (
      (n.channel_results->'email'->>'status'='failed' and coalesce(n.channel_results->'email'->>'reason','') in ('no_recipient','missing_content','sender_not_configured'))
      or (n.channel_results->'email'->>'status'='persistence_pending' and coalesce(n.reminder_lease_expires_at, '-infinity'::timestamptz) <= p_now and n.delivered_at > p_now-interval '24 hours')
    )
  order by n.delivered_at asc, n.id asc
  limit greatest(1, least(coalesce(p_limit, 50), 50));
$$;

create or replace function public.reconcile_expired_ambiguous_reminders(p_now timestamptz, p_limit integer default 50)
returns table(notification_id bigint) language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  return query
    with stale as (
      select n.id from public.notifications n
      where n.event='reminder'
        and n.channel_results->'email'->>'status'='persistence_pending'
        and coalesce(n.reminder_lease_expires_at, '-infinity'::timestamptz) <= p_now
        and n.delivered_at <= p_now-interval '24 hours'
      order by n.delivered_at asc, n.id asc
      limit greatest(1, least(coalesce(p_limit, 50), 50))
      for update
    )
    update public.notifications n set channel_results=jsonb_build_object('email',jsonb_build_object('ok',false,'status','reconciliation_required','reason','provider_delivery_unknown')), reminder_lease_expires_at=null
    from stale where n.id=stale.id returning n.id;
end;
$$;

create index if not exists notifications_reminder_reconciliation_idx on public.notifications(reminder_window_hours, delivered_at, id) where event='reminder';
create index if not exists notifications_reminder_ambiguous_reconciliation_idx on public.notifications(delivered_at, id) where event='reminder';

revoke all on function public.claim_reminder_notification(bigint,text,integer,text,text,timestamptz,text,text),public.find_retryable_reminder_appointments(integer,timestamptz,integer),public.reconcile_expired_ambiguous_reminders(timestamptz,integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_reminder_notification(bigint,text,integer,text,text,timestamptz,text,text),public.find_retryable_reminder_appointments(integer,timestamptz,integer),public.reconcile_expired_ambiguous_reminders(timestamptz,integer) to service_role;

commit;
