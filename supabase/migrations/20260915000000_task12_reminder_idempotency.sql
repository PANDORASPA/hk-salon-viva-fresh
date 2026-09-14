-- A reminder is claimed before any provider call. The unique index is the
-- authoritative idempotency boundary across concurrent cron invocations.
begin;

alter table public.notifications
  add column if not exists reminder_window_hours integer;

alter table public.notifications
  drop constraint if exists notifications_reminder_window_hours_check;
alter table public.notifications
  add constraint notifications_reminder_window_hours_check
  check (reminder_window_hours is null or reminder_window_hours between 1 and 168);

create unique index if not exists notifications_reminder_idempotency_idx
  on public.notifications (booking_id, event, reminder_window_hours)
  where booking_id is not null and reminder_window_hours is not null;

create or replace function public.claim_reminder_notification(
  p_booking_id bigint,
  p_event text,
  p_reminder_window_hours integer,
  p_customer_name text,
  p_customer_email text,
  p_starts_at timestamptz,
  p_email_subject text,
  p_email_body text
) returns table(notification_id bigint, claimed boolean)
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_notification_id bigint;
begin
  if p_booking_id is null or p_event <> 'reminder'
    or p_reminder_window_hours not between 1 and 168 then
    raise exception 'invalid_reminder_claim' using errcode = 'B0050';
  end if;

  insert into public.notifications (
    event, booking_id, customer_name, customer_email, starts_at,
    email_subject, email_body, reminder_window_hours, channel_results
  ) values (
    p_event, p_booking_id, nullif(trim(p_customer_name), ''), nullif(trim(p_customer_email), ''), p_starts_at,
    p_email_subject, p_email_body, p_reminder_window_hours,
    jsonb_build_object('email', jsonb_build_object('status', 'persistence_pending', 'reason', 'delivery_pending'))
  )
  on conflict (booking_id, event, reminder_window_hours)
    where booking_id is not null and reminder_window_hours is not null
    do nothing
  returning id into v_notification_id;

  return query select v_notification_id, v_notification_id is not null;
end;
$$;

revoke all on function public.claim_reminder_notification(bigint,text,integer,text,text,timestamptz,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_reminder_notification(bigint,text,integer,text,text,timestamptz,text,text)
  to service_role;

commit;
