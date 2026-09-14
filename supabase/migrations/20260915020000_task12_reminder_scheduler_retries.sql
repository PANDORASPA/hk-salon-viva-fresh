-- Bounded scheduler retries keep failed and expired reminder claims visible
-- beyond their original one-hour appointment query without revisiting final
-- notification outcomes.
begin;

create or replace function public.claim_reminder_notification(
  p_booking_id bigint, p_event text, p_reminder_window_hours integer, p_customer_name text,
  p_customer_email text, p_starts_at timestamptz, p_email_subject text, p_email_body text
) returns table(notification_id bigint, claimed boolean, claim_token uuid, attempt integer)
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_row public.notifications%rowtype; v_token uuid := gen_random_uuid();
begin
  if p_booking_id is null or p_event <> 'reminder' or p_reminder_window_hours not between 1 and 168 then
    raise exception 'invalid_reminder_claim' using errcode = 'B0050';
  end if;
  perform 1 from public.appointments where id=p_booking_id and status in ('pending','confirmed') for share;
  if not found then
    return query select null::bigint,false,null::uuid,0; return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_booking_id::text || ':' || p_event || ':' || p_reminder_window_hours::text, 0));
  select * into v_row from public.notifications where booking_id=p_booking_id and event=p_event and reminder_window_hours=p_reminder_window_hours for update;
  if not found then
    insert into public.notifications(event,booking_id,customer_name,customer_email,starts_at,email_subject,email_body,reminder_window_hours,reminder_claim_token,reminder_lease_expires_at,reminder_attempt,channel_results)
    values(p_event,p_booking_id,nullif(trim(p_customer_name),''),nullif(trim(p_customer_email),''),p_starts_at,p_email_subject,p_email_body,p_reminder_window_hours,v_token,now()+interval '5 minutes',1,
      jsonb_build_object('email',jsonb_build_object('ok',false,'status','persistence_pending','reason','delivery_pending')))
    returning * into v_row;
    return query select v_row.id,true,v_token,1; return;
  end if;
  if coalesce(v_row.channel_results->'email'->>'status','') in ('sent','disabled','dry_run') or v_row.reminder_attempt >= 5 then
    return query select v_row.id,false,null::uuid,v_row.reminder_attempt; return;
  end if;
  if v_row.channel_results->'email'->>'status'='persistence_pending' and v_row.reminder_lease_expires_at > now() then
    return query select v_row.id,false,null::uuid,v_row.reminder_attempt; return;
  end if;
  update public.notifications set reminder_claim_token=v_token,reminder_lease_expires_at=now()+interval '5 minutes',reminder_attempt=reminder_attempt+1,
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
    and a.starts_at >= p_now
    and a.starts_at < p_now + make_interval(hours => p_reminder_window_hours)
    and n.reminder_attempt < 5
    and (
      n.channel_results->'email'->>'status'='failed'
      or (n.channel_results->'email'->>'status'='persistence_pending' and coalesce(n.reminder_lease_expires_at, '-infinity'::timestamptz) <= p_now)
    )
  order by n.delivered_at asc, n.id asc
  limit greatest(1, least(coalesce(p_limit, 50), 50));
$$;

revoke all on function public.claim_reminder_notification(bigint,text,integer,text,text,timestamptz,text,text),public.find_retryable_reminder_appointments(integer,timestamptz,integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_reminder_notification(bigint,text,integer,text,text,timestamptz,text,text),public.find_retryable_reminder_appointments(integer,timestamptz,integer) to service_role;

commit;
