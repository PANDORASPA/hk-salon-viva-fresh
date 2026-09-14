-- Task 10 Fix Round 3: notification rows contain private contact details and
-- are written/read only by server-side service-role routes.
begin;

alter table public.notifications enable row level security;

-- Clear inherited or legacy browser grants. Existing admin policies remain as
-- defense in depth, but browser clients receive no table capability.
revoke all privileges on table public.notifications from public, anon, authenticated, service_role;
grant select, insert, update on table public.notifications to service_role;

-- Inserts use the identity sequence; dashboard reads and notification writes
-- need no DELETE privilege.
revoke all privileges on sequence public.notifications_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.notifications_id_seq to service_role;

commit;
