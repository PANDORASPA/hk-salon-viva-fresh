-- ============================================================
-- appointments: add customer_id + customer_package_id
-- update create_salon_appointment RPC for atomic package deduction
-- ============================================================

-- Ensure columns exist
DO $$ BEGIN
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_id bigint REFERENCES public.customers(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_package_id bigint REFERENCES public.customer_packages(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- New RPC: create_salon_appointment_with_package
-- Atomic: creates appointment + deducts package session
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_salon_appointment_with_package(
  p_user_id             uuid,
  p_service_id         bigint,
  p_customer_id         bigint,
  p_customer_package_id bigint,
  p_customer_name       text,
  p_customer_phone      text,
  p_customer_email      text,
  p_starts_at           timestamptz,
  p_admin_notes         text DEFAULT ''
) RETURNS public.appointments LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_appointment public.appointments;
  v_duration    integer;
  v_ends_at     timestamptz;
BEGIN
  -- Get service duration
  SELECT duration_minutes INTO v_duration
  FROM public.services WHERE id = p_service_id;

  v_duration := coalesce(v_duration, 60);
  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;

  -- Create appointment
  INSERT INTO public.appointments (
    user_id, service_id, customer_id, customer_package_id,
    customer_name, customer_phone, customer_email,
    starts_at, ends_at, admin_notes, status
  ) VALUES (
    p_user_id, p_service_id, p_customer_id, p_customer_package_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_starts_at, v_ends_at, p_admin_notes, 'confirmed'
  ) RETURNING * INTO v_appointment;

  -- Deduct package session if applicable
  IF p_customer_package_id IS NOT NULL THEN
    PERFORM public.deduct_package_session(p_customer_package_id, v_appointment.id);
  END IF;

  RETURN v_appointment;
END;
$$;
