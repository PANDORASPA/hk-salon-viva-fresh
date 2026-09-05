import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const corePath = new URL("../supabase/migrations/20260813000100_salon_poke_core.sql", import.meta.url);
const securityPath = new URL("../supabase/migrations/20260813000200_salon_poke_rls_storage.sql", import.meta.url);

test("Salon Poke schema defines every focused admin entity", async () => {
  const sql = await readFile(corePath, "utf8");
  for (const table of ["profiles", "admin_users", "services", "appointments", "business_hours", "blocked_dates", "gallery_images", "site_content", "admin_audit_logs"]) {
    assert.match(sql, new RegExp(`(?:CREATE TABLE|ALTER TABLE)[\\s\\S]*public\\.${table}`, "i"), table);
  }
  assert.match(sql, /Europe\/London/);
  assert.match(sql, /pending.*confirmed.*completed.*cancelled.*no_show/is);
});

test("all Salon Poke exposed tables enable row level security", async () => {
  const sql = await readFile(securityPath, "utf8");
  for (const table of ["profiles", "admin_users", "services", "appointments", "business_hours", "blocked_dates", "gallery_images", "site_content", "admin_audit_logs"]) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"), table);
  }
});

test("authorization is based on admin_users and protects the final admin", async () => {
  const sql = `${await readFile(corePath, "utf8")}\n${await readFile(securityPath, "utf8")}`;
  assert.match(sql, /FROM public\.admin_users[\s\S]*is_active = true/i);
  assert.doesNotMatch(sql, /user_metadata|raw_user_meta_data/);
  assert.match(sql, /cannot remove the final active admin/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_salon_admin\(\) FROM PUBLIC/i);
});

test("public policies only expose published catalogue and gallery rows", async () => {
  const sql = await readFile(securityPath, "utf8");
  assert.match(sql, /ON public\.services[\s\S]*TO anon, authenticated[\s\S]*published = true/i);
  assert.match(sql, /ON public\.gallery_images[\s\S]*TO anon, authenticated[\s\S]*published = true/i);
  assert.match(sql, /bucket_id = 'salon-gallery'/i);
  assert.match(sql, /public\.is_salon_admin\(\)/i);
});
