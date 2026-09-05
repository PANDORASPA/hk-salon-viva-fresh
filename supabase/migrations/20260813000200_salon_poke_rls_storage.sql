CREATE OR REPLACE FUNCTION public.is_salon_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true);
$$;
REVOKE ALL ON FUNCTION public.is_salon_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_salon_admin() TO authenticated, service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Salon profile own read" ON public.profiles;
CREATE POLICY "Salon profile own read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_salon_admin());
DROP POLICY IF EXISTS "Salon profile own update" ON public.profiles;
CREATE POLICY "Salon profile own update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Salon admins read admins" ON public.admin_users;
CREATE POLICY "Salon admins read admins" ON public.admin_users FOR SELECT TO authenticated USING (public.is_salon_admin());
DROP POLICY IF EXISTS "Salon admins manage admins" ON public.admin_users;
CREATE POLICY "Salon admins manage admins" ON public.admin_users FOR ALL TO authenticated USING (public.is_salon_admin()) WITH CHECK (public.is_salon_admin());

DROP POLICY IF EXISTS "Public read services" ON public.services;
CREATE POLICY "Salon public published services" ON public.services FOR SELECT TO anon, authenticated USING (published = true AND enabled = true);
CREATE POLICY "Salon admins manage services" ON public.services FOR ALL TO authenticated USING (public.is_salon_admin()) WITH CHECK (public.is_salon_admin());

CREATE POLICY "Salon customers read appointments" ON public.appointments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_salon_admin());
CREATE POLICY "Salon admins manage appointments" ON public.appointments FOR ALL TO authenticated USING (public.is_salon_admin()) WITH CHECK (public.is_salon_admin());

CREATE POLICY "Salon public read hours" ON public.business_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Salon admins manage hours" ON public.business_hours FOR ALL TO authenticated USING (public.is_salon_admin()) WITH CHECK (public.is_salon_admin());
CREATE POLICY "Salon public read blocks" ON public.blocked_dates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Salon admins manage blocks" ON public.blocked_dates FOR ALL TO authenticated USING (public.is_salon_admin()) WITH CHECK (public.is_salon_admin());

CREATE POLICY "Salon public published gallery" ON public.gallery_images FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "Salon admins manage gallery" ON public.gallery_images FOR ALL TO authenticated USING (public.is_salon_admin()) WITH CHECK (public.is_salon_admin());
CREATE POLICY "Salon public site content" ON public.site_content FOR SELECT TO anon, authenticated USING (id = 1);
CREATE POLICY "Salon admins manage site content" ON public.site_content FOR ALL TO authenticated USING (public.is_salon_admin()) WITH CHECK (public.is_salon_admin());
CREATE POLICY "Salon admins read audit" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.is_salon_admin());
CREATE POLICY "Salon admins write audit" ON public.admin_audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_salon_admin() AND COALESCE(actor_id, actor_user_id) = auth.uid());

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('salon-gallery','salon-gallery',true,10485760,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Salon gallery public objects" ON storage.objects;
CREATE POLICY "Salon gallery public objects" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'salon-gallery');
DROP POLICY IF EXISTS "Salon admins upload gallery" ON storage.objects;
CREATE POLICY "Salon admins upload gallery" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'salon-gallery' AND public.is_salon_admin());
DROP POLICY IF EXISTS "Salon admins update gallery" ON storage.objects;
CREATE POLICY "Salon admins update gallery" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'salon-gallery' AND public.is_salon_admin()) WITH CHECK (bucket_id = 'salon-gallery' AND public.is_salon_admin());
DROP POLICY IF EXISTS "Salon admins delete gallery" ON storage.objects;
CREATE POLICY "Salon admins delete gallery" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'salon-gallery' AND public.is_salon_admin());

GRANT SELECT ON public.services, public.business_hours, public.blocked_dates, public.gallery_images, public.site_content TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.admin_users, public.services, public.appointments, public.business_hours, public.blocked_dates, public.gallery_images, public.site_content TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
