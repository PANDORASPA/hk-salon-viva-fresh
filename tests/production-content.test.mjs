import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import defaultsModule from '../content/salon-poke-defaults.js'
import { publicContact } from '../lib/content/public-contact.js'

const { salonDefaults } = defaultsModule

test('fallback public content never publishes unverified contact details', () => {
  // Mutation caught: adding a plausible-looking phone, address, email, or
  // social account to defaults would turn a missing configuration into a lie.
  assert.deepEqual(salonDefaults.contact, {
    whatsapp: null,
    phone: null,
    email: null,
    instagram: null,
    address: null,
    addressNote: null,
  })
})

test('public contact controls are emitted only for valid administrator-supplied values', () => {
  // Mutation caught: rendering raw CMS values would create dangerous or
  // broken hrefs from blank, malformed, or non-HTTPS contact fields.
  assert.deepEqual(publicContact({
    whatsapp: 'not a number', phone: 'call me', email: 'not-an-email', instagram: 'javascript:alert(1)', address: ' ', addressNote: {},
  }), {
    whatsapp: null, whatsappHref: null, phone: null, email: null, instagram: null, address: null, addressNote: null,
  })
  assert.deepEqual(publicContact({
    whatsapp: '+852 9123 4567', phone: '+852 9123 4567', email: 'hello@salon.example', instagram: 'https://instagram.com/salon', address: 'Central', addressNote: 'By appointment only',
  }), {
    whatsapp: '85291234567', whatsappHref: 'https://wa.me/85291234567', phone: '+852 9123 4567', email: 'hello@salon.example', instagram: 'https://instagram.com/salon', address: 'Central', addressNote: 'By appointment only',
  })
})

test('phone and WhatsApp reject letters and punctuation-only values even when they contain digits', () => {
  // Mutation caught: stripping arbitrary characters turns "call 852..." into
  // a real-looking contact control and leaks malformed CMS data publicly.
  const contact = publicContact({
    whatsapp: 'call 852 9123 4567',
    phone: '---',
  })
  assert.equal(contact.whatsapp, null)
  assert.equal(contact.phone, null)
  assert.equal(publicContact({ whatsapp: '+852 (9123) 4567', phone: '+852 (9123) 4567' }).whatsapp, '85291234567')
})

test('public production sources contain no launch placeholders', async () => {
  const sources = await Promise.all(['content/salon-poke-defaults.js', 'app/layout.js', 'app/page.js', 'app/contact/page.js', 'app/location/page.js'].map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')))
  assert.doesNotMatch(sources.join('\n'), /XXXXXXXX|待提供|示意圖|example\.com/i)
})
