-- ============================================================
-- SALON POKE BY VIVA — contact_inquiries table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text    NOT NULL,
  phone       text,
  email       text,
  message     text    NOT NULL,
  status      text    NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied')),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Everyone can insert; only admins can read/update
CREATE POLICY "anyone_can_insert_contact_inquiries"
  ON public.contact_inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "admins_can_read_contact_inquiries"
  ON public.contact_inquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE administrators.user_id = auth.uid()
    )
  );

CREATE POLICY "admins_can_update_contact_inquiries"
  ON public.contact_inquiries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE administrators.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.contact_inquiries IS 'General contact form submissions from the public website.';
