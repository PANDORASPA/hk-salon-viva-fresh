-- SALON POKE BY VIVA — seed data

-- Services (爆毛術脫髮護理)
INSERT INTO public.services (name, price, duration_minutes, category, description, published, enabled, sort_order) VALUES
  ('創意剪髮', 48000, 60, '剪髮', '個人化剪裁造型，根據面型及風格打造完美髮型', true, true, 1),
  ('深層護理', 28000, 45, '護理', '深層滋潤受損髮質，修復乾枯毛躁', true, true, 2),
  ('電髮（離子燙/數碼燙）', 68000, 120, '電髮', '持久離子燙或數碼燙', true, true, 3),
  ('染髮（全染/漂染）', 58000, 90, '染髮', '優質染劑，顏色持久自然', true, true, 4),
  ('爆毛術增髮護理', 88000, 90, '增髮', '專為脫髮問題而設的深層護理，激活毛囊', true, true, 5),
  ('脫髮評估', 18000, 30, '諮詢', '專業脫髮情況評估及建議', true, true, 6)
ON CONFLICT DO NOTHING;

-- Packages
INSERT INTO public.packages (name, colour_hex, description, total_sessions, validity_days, price_hkd, is_active) VALUES
  ('爆毛術基本套票', '#c9a97a', '包含6次爆毛術增髮護理及深層護理', 6, 180, 4800, true),
  ('爆毛術標準套票', '#a98152', '包含12次爆毛術增髮護理及深層護理', 12, 365, 8800, true),
  ('爆毛術尊尚套票', '#8f7043', '包含24次爆毛術增髮護理及深層護理', 24, 365, 16000, true),
  ('脫髮評估套票', '#d4b896', '包含3次專業脫髮評估及深層護理', 3, 90, 980, true)
ON CONFLICT DO NOTHING;

-- Package → Services links
DO $$
DECLARE
  s_basic   bigint := (SELECT id FROM public.packages WHERE name = '爆毛術基本套票' LIMIT 1);
  s_standard bigint := (SELECT id FROM public.packages WHERE name = '爆毛術標準套票' LIMIT 1);
  s_premium bigint := (SELECT id FROM public.packages WHERE name = '爆毛術尊尚套票' LIMIT 1);
  s_eval    bigint := (SELECT id FROM public.packages WHERE name = '脫髮評估套票' LIMIT 1);
  svc_hair  bigint := (SELECT id FROM public.services WHERE name = '爆毛術增髮護理' LIMIT 1);
  svc_care  bigint := (SELECT id FROM public.services WHERE name = '深層護理' LIMIT 1);
  svc_eval  bigint := (SELECT id FROM public.services WHERE name = '脫髮評估' LIMIT 1);
BEGIN
  IF s_basic IS NOT NULL AND svc_hair IS NOT NULL THEN
    INSERT INTO public.package_services (package_id, service_id) VALUES (s_basic, svc_hair) ON CONFLICT DO NOTHING;
  END IF;
  IF s_basic IS NOT NULL AND svc_care IS NOT NULL THEN
    INSERT INTO public.package_services (package_id, service_id) VALUES (s_basic, svc_care) ON CONFLICT DO NOTHING;
  END IF;
  IF s_standard IS NOT NULL AND svc_hair IS NOT NULL THEN
    INSERT INTO public.package_services (package_id, service_id) VALUES (s_standard, svc_hair) ON CONFLICT DO NOTHING;
  END IF;
  IF s_standard IS NOT NULL AND svc_care IS NOT NULL THEN
    INSERT INTO public.package_services (package_id, service_id) VALUES (s_standard, svc_care) ON CONFLICT DO NOTHING;
  END IF;
  IF s_premium IS NOT NULL AND svc_hair IS NOT NULL THEN
    INSERT INTO public.package_services (package_id, service_id) VALUES (s_premium, svc_hair) ON CONFLICT DO NOTHING;
  END IF;
  IF s_premium IS NOT NULL AND svc_care IS NOT NULL THEN
    INSERT INTO public.package_services (package_id, service_id) VALUES (s_premium, svc_care) ON CONFLICT DO NOTHING;
  END IF;
  IF s_eval IS NOT NULL AND svc_eval IS NOT NULL THEN
    INSERT INTO public.package_services (package_id, service_id) VALUES (s_eval, svc_eval) ON CONFLICT DO NOTHING;
  END IF;
  IF s_eval IS NOT NULL AND svc_care IS NOT NULL THEN
    INSERT INTO public.package_services (package_id, service_id) VALUES (s_eval, svc_care) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Sample customers
INSERT INTO public.customers (name, phone, email, notes) VALUES
  ('陳小姐', '91234567', 'chan@example.com', '脫髮問題，2024年6月開始療程'),
  ('王先生', '97876543', 'wang@example.com', '頭髮稀疏，定期深層護理'),
  ('林女士', '94445566', 'lam@example.com', '電髮後修護')
ON CONFLICT DO NOTHING;

-- Assign packages to customers
DO $$
DECLARE
  c1 bigint := (SELECT id FROM public.customers WHERE phone = '91234567' LIMIT 1);
  c2 bigint := (SELECT id FROM public.customers WHERE phone = '97876543' LIMIT 1);
  c3 bigint := (SELECT id FROM public.customers WHERE phone = '94445566' LIMIT 1);
  p1 bigint := (SELECT id FROM public.packages WHERE name = '爆毛術標準套票' LIMIT 1);
  p2 bigint := (SELECT id FROM public.packages WHERE name = '爆毛術基本套票' LIMIT 1);
  p3 bigint := (SELECT id FROM public.packages WHERE name = '爆毛術尊尚套票' LIMIT 1);
BEGIN
  IF c1 IS NOT NULL AND p1 IS NOT NULL THEN
    INSERT INTO public.customer_packages (customer_id, package_id, total_sessions, sessions_remaining, expires_at)
    VALUES (c1, p1, 12, 8, now() + interval '365 days') ON CONFLICT DO NOTHING;
  END IF;
  IF c2 IS NOT NULL AND p2 IS NOT NULL THEN
    INSERT INTO public.customer_packages (customer_id, package_id, total_sessions, sessions_remaining, expires_at)
    VALUES (c2, p2, 6, 3, now() + interval '180 days') ON CONFLICT DO NOTHING;
  END IF;
  IF c3 IS NOT NULL AND p3 IS NOT NULL THEN
    INSERT INTO public.customer_packages (customer_id, package_id, total_sessions, sessions_remaining, expires_at)
    VALUES (c3, p3, 24, 22, now() + interval '365 days') ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Site content (defaults)
INSERT INTO public.site_content (data) VALUES (
  '{"identity":{"name":"SALON POKE BY VIVA","shortName":"SALON POKE","tagline":"爆毛術脫髮護理","eyebrow":"香港 · 敬請預約","heroTitle":"亞洲人髮絲專家","heroBody":"超過20年專業經驗，專精剪髮、染髮、電髮、離子夾及頭髮修護。我們專注為亞洲髮質提供量身訂造的護理方案，在私密的香港市中心工作室為你服務。"},"contact":{"whatsapp":"852XXXXXXXX","phone":"852XXXXXXXX","email":"info@salonpokeviva.com","area":"香港","addressNote":"確實地址於預約確認後以 WhatsApp 發送"},"business":{"openDays":"星期一至六","hours":"10:00 – 19:00","closedDays":"星期日及公眾假期休息"},"bookingNotice":"預約確認後我們會發送 WhatsApp 訊息，包含工作室確實地址。"}'
) ON CONFLICT DO NOTHING;
