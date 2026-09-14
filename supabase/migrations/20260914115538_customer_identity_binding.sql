begin;

alter table public.customers add column user_id uuid unique references auth.users(id);
-- Email-only accounts, and verified phones already held by legacy customers,
-- must get a distinct owned row without fabricated phone numbers or auto-links.
alter table public.customers alter column phone drop not null;

drop policy if exists "Public lookup by phone" on public.customers;
drop policy if exists "Admins manage customers" on public.customers;
drop policy if exists "Customer read own packages" on public.customer_packages;
drop policy if exists "Admins manage customer_packages" on public.customer_packages;

alter table public.customers enable row level security;
alter table public.customer_packages enable row level security;
revoke all on public.customers, public.customer_packages from public, anon, authenticated;
-- Table revocation does not remove pre-existing column grants. Clear those too
-- before exposing the exact customer-visible projection to browser roles.
revoke select(id,name,phone,email,notes,created_at,updated_at,user_id)
  on public.customers from public, anon, authenticated;
grant select(id,name,phone,email) on public.customers to authenticated;
grant select on public.customer_packages to authenticated;
grant update(name,phone,email) on public.customers to authenticated;
grant select, insert, update, delete on public.customers, public.customer_packages to service_role;
revoke all on sequence public.customers_id_seq, public.customer_packages_id_seq from public, anon, authenticated;
grant usage on sequence public.customers_id_seq, public.customer_packages_id_seq to service_role;

create policy customers_read_own on public.customers for select to authenticated
  using ((select auth.uid()) = user_id);
create policy customers_update_own on public.customers for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy customer_packages_read_own on public.customer_packages for select to authenticated
  using (exists (select 1 from public.customers c
    -- The customers owner policy filters this subquery. Only id needs a browser
    -- column grant; the private Auth binding remains unreadable to the caller.
    where c.id = customer_id));

-- Owners need the same public catalogue relations that guests can read.
create policy packages_authenticated_active on public.packages for select to authenticated
  using (is_active = true);
create policy package_services_authenticated_read on public.package_services for select to authenticated
  using (true);

commit;
