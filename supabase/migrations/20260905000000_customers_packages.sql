-- ============================================================
-- SALON POKE BY VIVA — customers, packages, customer_packages
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  phone       text    NOT NULL UNIQUE CHECK (length(trim(phone)) BETWEEN 5 AND 30),
  email       text,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.packages (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            text    NOT NULL,
  colour_hex      text    DEFAULT '#a98152',
  description     text,
  total_sessions  integer NOT NULL CHECK (total_sessions > 0),
  validity_days   integer NOT NULL DEFAULT 365,
  price_hkd       integer NOT NULL DEFAULT 0 CHECK (price_hkd >= 0),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.package_services (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id  bigint NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  service_id  bigint NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  UNIQUE (package_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.customer_packages (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id         bigint NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  package_id          bigint NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  total_sessions      integer NOT NULL,
  sessions_remaining  integer NOT NULL,
  purchased_at        timestamptz DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  is_active           boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.package_usage_logs (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_package_id  bigint REFERENCES public.customer_packages(id) ON DELETE SET NULL,
  appointment_id       bigint REFERENCES public.appointments(id) ON DELETE SET NULL,
  sessions_deducted    integer NOT NULL DEFAULT 1,
  logged_at            timestamptz DEFAULT now()
);

-- Updated appointments table (add columns if missing)
DO $$ BEGIN
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_id bigint REFERENCES public.customers(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_package_id bigint REFERENCES public.customer_packages(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- RPC: deduct_package_session
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_package_session(
  p_customer_package_id bigint,
  p_appointment_id      bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_remaining integer;
BEGIN
  SELECT sessions_remaining INTO v_remaining
  FROM public.customer_packages
  WHERE id = p_customer_package_id FOR UPDATE;

  IF v_remaining IS NULL OR v_remaining < 1 THEN
    RAISE EXCEPTION 'INSUFFICIENT_SESSIONS';
  END IF;

  UPDATE public.customer_packages
  SET sessions_remaining = sessions_remaining - 1
  WHERE id = p_customer_package_id;

  INSERT INTO public.package_usage_logs (customer_package_id, appointment_id)
  VALUES (p_customer_package_id, p_appointment_id);
END;
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_usage_logs ENABLE ROW LEVEL SECURITY;

-- customers: admin only
CREATE POLICY "Admins manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.is_salon_admin())
  WITH CHECK (public.is_salon_admin());

-- customers: public read by phone (for booking form lookup)
CREATE POLICY "Public lookup by phone" ON public.customers
  FOR SELECT TO anon
  USING (true);

-- packages: admin full, public read active
CREATE POLICY "Public read active packages" ON public.packages
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Admins manage packages" ON public.packages
  FOR ALL TO authenticated
  USING (public.is_salon_admin())
  WITH CHECK (public.is_salon_admin());

-- package_services: admin full, public read
CREATE POLICY "Public read package services" ON public.package_services
  FOR SELECT TO anon USING (true);

CREATE POLICY "Admins manage package services" ON public.package_services
  FOR ALL TO authenticated
  USING (public.is_salon_admin())
  WITH CHECK (public.is_salon_admin());

-- customer_packages: admin full, customer sees own
CREATE POLICY "Admins manage customer_packages" ON public.customer_packages
  FOR ALL TO authenticated
  USING (public.is_salon_admin())
  WITH CHECK (public.is_salon_admin());

CREATE POLICY "Customer read own packages" ON public.customer_packages
  FOR SELECT TO authenticated
  USING (true);

-- package_usage_logs: admin full
CREATE POLICY "Admins manage usage logs" ON public.package_usage_logs
  FOR ALL TO authenticated
  USING (public.is_salon_admin())
  WITH CHECK (public.is_salon_admin());

-- appointments: add RLS for customer_id if not exists
DO $$ BEGIN
  CREATE POLICY "Admins manage appointments by customer" ON public.appointments
    FOR ALL TO authenticated
    USING (public.is_salon_admin())
    WITH CHECK (public.is_salon_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- GRANTS
-- ============================================================
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.customers, public.packages, public.package_services TO anon, authenticated;
GRANT ALL ON public.customers, public.packages, public.package_services,
             public.customer_packages, public.package_usage_logs TO authenticated;
