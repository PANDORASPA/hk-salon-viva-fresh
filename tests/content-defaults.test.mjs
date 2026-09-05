import assert from "node:assert/strict";
import test from "node:test";

import defaultsModule from "../content/salon-poke-defaults.js";

const { salonDefaults } = defaultsModule;

test("Salon Poke defaults preserve the live identity and contact paths", () => {
  assert.equal(salonDefaults.identity.name, "Salon Poke Bristol");
  assert.equal(salonDefaults.identity.tagline, "Asian hair salon");
  assert.equal(salonDefaults.contact.whatsapp, "447724594963");
  assert.equal(salonDefaults.contact.email, "hello@salonpokebristol.com");
  assert.equal(salonDefaults.contact.instagram, "salonpokebristol");
  assert.equal(salonDefaults.contact.area, "Bristol City Centre · Park Row Area");
});

test("Salon Poke defaults cover every preserved public route", () => {
  const required = [
    "/",
    "/services",
    "/booking",
    "/gallery",
    "/about",
    "/location",
    "/contact",
    "/signin",
    "/signup",
    "/account",
    "/terms",
    "/privacy",
  ];

  assert.deepEqual(salonDefaults.routes, required);
});

test("Salon Poke defaults retain the visible live service menu", () => {
  assert.ok(salonDefaults.services.length >= 8);
  assert.deepEqual(
    salonDefaults.services.slice(0, 3).map(({ name, pricePence }) => ({ name, pricePence })),
    [
      { name: "Men's Haircut (Dry)", pricePence: 3500 },
      { name: "Men's Haircut (Shampoo + Cut)", pricePence: 4000 },
      { name: "Ladies' Haircut (Shampoo + Cut)", pricePence: 4000 },
    ],
  );
  assert.ok(salonDefaults.services.every((service) => service.durationMinutes > 0));
});

test("Salon Poke defaults provide meaningful gallery metadata", () => {
  assert.ok(salonDefaults.gallery.length >= 6);
  assert.ok(salonDefaults.gallery.every((image) => image.alt && image.label));
});
