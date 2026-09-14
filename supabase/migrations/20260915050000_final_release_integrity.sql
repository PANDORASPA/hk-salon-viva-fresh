begin;

-- CLI created this migration; version advanced past the existing future-dated
-- inventory so a full replay always applies the final access boundary last.
do $$ declare r record; cols text; begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='appointments' loop
    execute format('drop policy %I on public.appointments', r.policyname);
  end loop;
  select string_agg(quote_ident(attname),',') into cols from pg_attribute
    where attrelid='public.appointments'::regclass and attnum>0 and not attisdropped;
  execute 'revoke select('||cols||'),insert('||cols||'),update('||cols||'),references('||cols||') on public.appointments from public,anon,authenticated';
end $$;
revoke all on public.appointments from public,anon,authenticated;
grant select(id,reference,service_id,staff_id,starts_at,ends_at,status,customer_name,customer_phone,customer_email,customer_notes,created_at)
  on public.appointments to authenticated;
create policy appointments_owner_read on public.appointments for select to authenticated
  using (user_id=(select auth.uid()));

-- The confirmation embed needs its appointment FK and payment timestamps only.
-- The subquery inherits appointments owner RLS without granting private user_id.
revoke all on public.package_redemptions from public,anon,authenticated;
revoke select(id,customer_package_id,appointment_id,redeemed_at,refunded_at)
  on public.package_redemptions from public,anon,authenticated;
grant select(appointment_id,redeemed_at,refunded_at) on public.package_redemptions to authenticated;
create policy redemptions_owner_payment_read on public.package_redemptions for select to authenticated
  using (exists(select 1 from public.appointments a where a.id=appointment_id));

-- The server uses audited commands; legacy browser administrators cannot write
-- tables or gallery objects around the route guards and durable audits.
revoke insert,update,delete on public.business_hours,public.blocked_dates,public.gallery_images,public.package_usage_logs
  from public,anon,authenticated;
do $$ declare target text; cols text; begin
  foreach target in array array['business_hours','blocked_dates','gallery_images','package_usage_logs','package_redemptions'] loop
    select string_agg(quote_ident(attname),',') into cols from pg_attribute
      where attrelid=format('public.%I',target)::regclass and attnum>0 and not attisdropped;
    execute format('revoke insert(%s),update(%s) on public.%I from public,anon,authenticated',cols,cols,target);
  end loop;
end $$;
drop policy if exists "Salon admins upload gallery" on storage.objects;
drop policy if exists "Salon admins update gallery" on storage.objects;
drop policy if exists "Salon admins delete gallery" on storage.objects;
grant select,insert,update,delete on public.business_hours to service_role;
grant select,insert,update,delete on public.blocked_dates,public.gallery_images to service_role;
grant delete on public.appointments,public.package_redemptions to service_role;
grant select,delete on public.package_usage_logs to service_role;
grant select,insert,update,delete on public.profiles to service_role;
grant usage on sequence public.blocked_dates_id_seq,public.gallery_images_id_seq to service_role;

update public.app_settings set data=jsonb_set(data,'{booking_buffer_minutes}','15')
where not coalesce((data->>'booking_buffer_minutes') ~ '^(0|[1-9][0-9]?|1[01][0-9]|120)$',false);
create function public.validate_booking_settings() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.data ? 'booking_buffer_minutes' and not coalesce((new.data->>'booking_buffer_minutes') ~ '^(0|[1-9][0-9]?|1[01][0-9]|120)$',false)
  then raise exception 'invalid_settings' using errcode='B0044'; end if;
  return new;
end $$;
create trigger validate_booking_settings before insert or update on public.app_settings for each row execute function public.validate_booking_settings();
revoke all on function public.validate_booking_settings() from public,anon,authenticated;
grant execute on function public.validate_booking_settings() to service_role;

-- Preserve non-UI operational metadata (for example the isolated E2E marker).
-- The route validates editable fields; the transaction locks and merges them.
create or replace function public.admin_save_settings(p_actor_id uuid,p_data jsonb)
returns public.app_settings language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before jsonb; v_after public.app_settings%rowtype;
begin
  perform public.admin_require_active_actor(p_actor_id);
  if p_data is null or jsonb_typeof(p_data)<>'object' or p_data-array['reminder_hours_before','cancel_cutoff_hours','booking_buffer_minutes','slot_step_minutes','minimum_lead_minutes','maximum_advance_days','notify_email_enabled','notify_whatsapp_enabled','notify_console_enabled','notify_dry_run','auto_issue_packages','require_deposit','whatsapp_provider','email_provider']<>'{}'::jsonb
    then raise exception 'invalid_settings' using errcode='B0044'; end if;
  select data into v_before from public.app_settings where id=1 for update;
  if not found then raise exception 'settings_not_found' using errcode='B0045'; end if;
  update public.app_settings set data=v_before||p_data,updated_by=p_actor_id,updated_at=now() where id=1 returning * into v_after;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data)
    values(p_actor_id,p_actor_id,'app-settings.update','app_settings','1','app_settings','1',v_before,v_after.data);
  return v_after;
end $$;
revoke all on function public.admin_save_settings(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_settings(uuid,jsonb) to service_role;

create table public.admin_package_issuances (
  request_key uuid primary key,
  customer_id bigint not null references public.customers(id),
  package_id bigint not null references public.packages(id),
  customer_package_id bigint not null references public.customer_packages(id),
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_package_issuances enable row level security;
revoke all on public.admin_package_issuances from public,anon,authenticated;
grant select,insert,delete on public.admin_package_issuances to service_role;
create index admin_package_issuances_customer_idx on public.admin_package_issuances(customer_id);
create index admin_package_issuances_package_idx on public.admin_package_issuances(package_id);
create index admin_package_issuances_entitlement_idx on public.admin_package_issuances(customer_package_id);

-- Finite, explicit command set. No dynamic table/column SQL is accepted. The
-- shared final audit insert is in the same transaction as every mutation.
create function public.admin_manage_record(p_actor_id uuid,p_kind text,p_id bigint,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before jsonb; v_after jsonb; v_table text; v_id bigint; v_row record;
  v_package public.packages%rowtype; v_issue public.admin_package_issuances%rowtype;
  v_name text; v_phone text; v_email text; v_reason text; v_request uuid;
begin
  perform public.admin_require_active_actor(p_actor_id);
  if p_data is null or jsonb_typeof(p_data)<>'object' or p_id<1 then raise exception 'invalid_payload' using errcode='B0041'; end if;
  v_id:=p_id;
  if p_kind='customer' then
    if p_data - array['name','phone','email','notes'] <> '{}'::jsonb then raise exception 'invalid_payload' using errcode='B0041'; end if;
    v_name:=trim(p_data->>'name'); v_phone:=nullif(trim(p_data->>'phone'),''); v_email:=nullif(lower(trim(p_data->>'email')),'');
    if v_name is null or length(v_name) not between 2 and 120 or (v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{7,30}$')
      or (v_email is not null and (length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
      or length(coalesce(p_data->>'notes',''))>2000 then raise exception 'invalid_customer' using errcode='B0041'; end if;
    v_table:='customers';
    if p_id is null then
      insert into public.customers(name,phone,email,notes) values(v_name,v_phone,v_email,nullif(p_data->>'notes','')) returning id,to_jsonb(customers.*) into v_id,v_after;
    else
      select to_jsonb(c) into v_before from public.customers c where id=p_id for update;
      if v_before is null then raise exception 'record_not_found' using errcode='B0043'; end if;
      update public.customers set name=v_name,phone=v_phone,email=v_email,notes=nullif(p_data->>'notes',''),updated_at=now() where id=p_id returning to_jsonb(customers.*) into v_after;
    end if;
  elsif p_kind='issue_package' then
    if p_data - array['customerId','packageId','reason','requestKey'] <> '{}'::jsonb then raise exception 'invalid_payload' using errcode='B0041'; end if;
    v_reason:=trim(coalesce(p_data->>'reason','')); v_request:=(p_data->>'requestKey')::uuid;
    if v_request is null or length(v_reason) not between 1 and 500 then raise exception 'reason_required' using errcode='B0031'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_request::text,6201103));
    select * into v_issue from public.admin_package_issuances where request_key=v_request;
    if found then
      if v_issue.customer_id is distinct from (p_data->>'customerId')::bigint or v_issue.package_id is distinct from (p_data->>'packageId')::bigint or v_issue.reason<>v_reason
        then raise exception 'idempotency_conflict' using errcode='B0041'; end if;
      select to_jsonb(cp) into v_after from public.customer_packages cp where id=v_issue.customer_package_id;
      return v_after;
    end if;
    perform 1 from public.customers where id=(p_data->>'customerId')::bigint and user_id is not null for share;
    if not found then raise exception 'ownership_required' using errcode='B0003'; end if;
    select * into v_package from public.packages where id=(p_data->>'packageId')::bigint and is_active for share;
    if not found then raise exception 'package_not_found' using errcode='B0043'; end if;
    insert into public.customer_packages(customer_id,package_id,total_sessions,sessions_remaining,expires_at,is_active)
      values((p_data->>'customerId')::bigint,v_package.id,v_package.total_sessions,v_package.total_sessions,now()+make_interval(days=>v_package.validity_days),true)
      returning id,to_jsonb(customer_packages.*) into v_id,v_after;
    insert into public.admin_package_issuances(request_key,customer_id,package_id,customer_package_id,reason)
      values(v_request,(p_data->>'customerId')::bigint,v_package.id,v_id,v_reason);
    v_table:='customer_packages';
  elsif p_kind in ('customer_package','package_state') then
    if jsonb_typeof(p_data->'isActive') is distinct from 'boolean' or p_data-array['isActive','reason']<>'{}'::jsonb
      then raise exception 'invalid_payload' using errcode='B0041'; end if;
    if p_kind='customer_package' then
      if length(trim(coalesce(p_data->>'reason',''))) not between 1 and 500 then raise exception 'reason_required' using errcode='B0031'; end if;
      v_table:='customer_packages';
      select to_jsonb(cp) into v_before from public.customer_packages cp where id=p_id for update;
      update public.customer_packages set is_active=(p_data->>'isActive')::boolean where id=p_id returning to_jsonb(customer_packages.*) into v_after;
    else
      v_table:='packages';
      select to_jsonb(p) into v_before from public.packages p where id=p_id for update;
      update public.packages set is_active=(p_data->>'isActive')::boolean where id=p_id returning to_jsonb(packages.*) into v_after;
    end if;
    if v_before is null then raise exception 'record_not_found' using errcode='B0043'; end if;
  elsif p_kind='schedule_hours' then
    if p_data-array['hours']<>'{}'::jsonb or jsonb_typeof(p_data->'hours') is distinct from 'array' or jsonb_array_length(p_data->'hours')<>7 then raise exception 'invalid_hours' using errcode='B0041'; end if;
    if (select count(distinct (x->>'weekday')::int) from jsonb_array_elements(p_data->'hours') x)<>7 then raise exception 'invalid_hours' using errcode='B0041'; end if;
    perform 1 from public.business_hours order by weekday for update;
    select jsonb_agg(to_jsonb(h) order by weekday) into v_before from public.business_hours h;
    for v_row in select * from jsonb_to_recordset(p_data->'hours') as x(weekday int,is_open boolean,opens_at text,closes_at text) loop
      if v_row.weekday is null or v_row.weekday not between 0 and 6 or v_row.is_open is null or (v_row.is_open and
        (v_row.opens_at is null or v_row.closes_at is null or v_row.opens_at !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$' or v_row.closes_at !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$' or v_row.opens_at::time>=v_row.closes_at::time))
        then raise exception 'invalid_hours' using errcode='B0041'; end if;
      insert into public.business_hours(weekday,is_open,opens_at,closes_at) values(v_row.weekday,v_row.is_open,case when v_row.is_open then v_row.opens_at::time end,case when v_row.is_open then v_row.closes_at::time end)
        on conflict(weekday) do update set is_open=excluded.is_open,opens_at=excluded.opens_at,closes_at=excluded.closes_at,updated_at=now();
    end loop;
    select jsonb_agg(to_jsonb(h) order by weekday) into v_after from public.business_hours h;
    v_table:='business_hours';
  elsif p_kind in ('closure','closure_delete') then
    v_table:='blocked_dates';
    if p_kind='closure' then
      if p_data-array['startsOn','endsOn','reason']<>'{}'::jsonb or coalesce(p_data->>'startsOn','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_data->>'endsOn','') !~ '^\d{4}-\d{2}-\d{2}$'
        or length(coalesce(p_data->>'reason',''))>240 or (p_data->>'endsOn')::date<(p_data->>'startsOn')::date then raise exception 'invalid_closure' using errcode='B0041'; end if;
      insert into public.blocked_dates(starts_on,ends_on,reason) values((p_data->>'startsOn')::date,(p_data->>'endsOn')::date,p_data->>'reason') returning id,to_jsonb(blocked_dates.*) into v_id,v_after;
    else
      select to_jsonb(b) into v_before from public.blocked_dates b where id=p_id for update;
      if v_before is null then raise exception 'record_not_found' using errcode='B0043'; end if;
      delete from public.blocked_dates where id=p_id;
    end if;
  elsif p_kind in ('gallery_create','gallery_update','gallery_delete') then
    v_table:='gallery_images';
    if p_kind<>'gallery_create' then
      select to_jsonb(g) into v_before from public.gallery_images g where id=p_id for update;
      if v_before is null then raise exception 'record_not_found' using errcode='B0043'; end if;
    end if;
    if p_kind='gallery_delete' then delete from public.gallery_images where id=p_id;
    else
      if length(trim(coalesce(p_data->>'altText',''))) not between 1 and 240 or length(coalesce(p_data->>'caption',''))>240
        or jsonb_typeof(p_data->'published') is distinct from 'boolean' or not coalesce((p_data->>'sortOrder') ~ '^-?\d{1,6}$',false)
        then raise exception 'invalid_gallery' using errcode='B0041'; end if;
      if p_kind='gallery_create' then
        insert into public.gallery_images(storage_path,alt_text,caption,published,sort_order) values(p_data->>'storagePath',trim(p_data->>'altText'),p_data->>'caption',(p_data->>'published')::boolean,(p_data->>'sortOrder')::int)
          returning id,to_jsonb(gallery_images.*) into v_id,v_after;
      else
        update public.gallery_images set alt_text=trim(p_data->>'altText'),caption=p_data->>'caption',published=(p_data->>'published')::boolean,sort_order=(p_data->>'sortOrder')::int where id=p_id returning to_jsonb(gallery_images.*) into v_after;
      end if;
    end if;
  else raise exception 'unsupported_command' using errcode='B0041';
  end if;
  insert into public.admin_audit_logs(actor_id,actor_user_id,action,entity_type,entity_id,target_table,target_id,before_data,after_data,metadata)
    values(p_actor_id,p_actor_id,p_kind,v_table,v_id::text,v_table,v_id::text,v_before,v_after,jsonb_build_object('reason',p_data->>'reason','requestKey',p_data->>'requestKey'));
  return coalesce(v_after,jsonb_build_object('id',v_id,'deleted',true));
end $$;
revoke all on function public.admin_manage_record(uuid,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.admin_manage_record(uuid,text,bigint,jsonb) to service_role;
commit;
