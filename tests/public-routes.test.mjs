import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const publicFiles = [
  "app/layout.js",
  "app/page.js",
  "app/services/page.js",
  "app/booking/page.js",
  "app/gallery/page.js",
  "app/about/page.js",
  "app/location/page.js",
  "app/contact/page.js",
  "app/terms/page.js",
  "app/privacy/page.js",
];

test("public Salon Poke pages contain no Pandora storefront branding", async () => {
  for (const file of publicFiles) {
    const source = await read(file);
    assert.doesNotMatch(source, /PANDORA HEAD SPA|tickets|Stripe Checkout/i, file);
  }
});

test("shared navigation exposes the live Salon Poke route set", async () => {
  const source = await read("app/components/Navbar.js");
  for (const route of ["/services", "/booking", "/gallery", "/about", "/location", "/contact", "/signin"]) {
    assert.match(source, new RegExp(route.replace("/", "\\/")), route);
  }
  assert.doesNotMatch(source, /\/tickets|\/products|\/articles|\/faq/);
});

test("home page preserves the live primary message and contact action", async () => {
  const source = await read("app/page.js");
  const defaults = await read("content/salon-poke-defaults.js");
  assert.match(source, /salon\.identity\.heroTitle/);
  assert.match(source, /salon\.contact\.whatsapp/);
  assert.match(defaults, /Hong Kong Hairstylist in Bristol/);
  assert.match(defaults, /447724594963/);
  assert.match(source, /Book Your Appointment/);
});
