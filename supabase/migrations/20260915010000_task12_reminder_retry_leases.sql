-- Recoverable, token-bound reminder leases. A worker may retry a failed or
-- expired claim, while completed outcomes retain their idempotency boundary.
begin;

alter table public.notifications add column if not exists reminder_claim_token uuid;
alter table public.notifications add column if not exists reminder_lease_expires_at timestamptz;
alter table public.notifications add column if not exists reminder_attempt integer not null default 0;
alter table public.notifications drop constraint if exists notifications_reminder_attempt_check;
alter table public.notifications add constraint notifications_reminder_attempt_check check (reminder_attempt >= 0 and reminder_attempt <= 100);

drop function if exists public.claim_reminder_notification(bigint,text,integer,text,text,timestamptz,text,text);
create function public.claim_reminder_notification(
  p_booking_id bigint, p_event text, p_reminder_window_hours integer, p_customer_name text,
  p_customer_email text, p_starts_at timestamptz, p_email_subject text, p_email_body text
) returns table(notification_id bigint, claimed boolean, claim_token uuid, attempt integer)
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_row public.notifications%rowtype; v_token uuid := gen_random_uuid();
begin
  if p_booking_id is null or p_event <> 'reminder' or p_reminder_window_hours not between 1 and 168 then
    raise exception 'invalid_reminder_claim' using errcode = 'B0050';
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
  if coalesce(v_row.channel_results->'email'->>'status','') in ('sent','disabled','dry_run') then
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

create or replace function public.finalize_reminder_notification(p_notification_id bigint,p_claim_token uuid,p_channel_results jsonb)
returns table(finalized boolean) language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if p_notification_id is null or p_claim_token is null or jsonb_typeof(p_channel_results) <> 'object' then raise exception 'invalid_reminder_finalization' using errcode='B0051'; end if;
  update public.notifications set channel_results=p_channel_results,reminder_lease_expires_at=null where id=p_notification_id and reminder_claim_token=p_claim_token and coalesce(channel_results->'email'->>'status','')='persistence_pending';
  return query select found;
end;
$$;

revoke all on function public.claim_reminder_notification(bigint,text,integer,text,text,timestamptz,text,text),public.finalize_reminder_notification(bigint,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.claim_reminder_notification(bigint,text,integer,text,text,timestamptz,text,text),public.finalize_reminder_notification(bigint,uuid,jsonb) to service_role;

commit;
