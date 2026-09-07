import assert from 'node:assert/strict'
import test from 'node:test'

import defaultsModule from '../content/salon-poke-defaults.js'

const { salonDefaults, defaultServices } = defaultsModule

test('Salon Poke defaults use the HK hair loss treatment brand', () => {
  assert.match(salonDefaults.identity.name, /SALON POKE BY VIVA/)
  assert.match(salonDefaults.identity.tagline, /爆毛術/)
  assert.ok(salonDefaults.contact.whatsapp, 'whatsapp placeholder must exist')
  assert.ok(salonDefaults.contact.email, 'contact email must exist')
  assert.match(salonDefaults.business.openDays, /星期/)
  assert.match(salonDefaults.business.hours, /\d{2}:\d{2}/)
})

test('Salon Poke defaults expose the canonical service menu (6 fallback services)', () => {
  assert.ok(Array.isArray(defaultServices))
  assert.ok(defaultServices.length >= 6, 'must include at least 6 fallback services')
  for (const s of defaultServices) {
    assert.ok(s.name, 'service must have a name')
    assert.ok(Number.isFinite(s.pricePence) && s.pricePence > 0, 'service must have a price in pence/HKD')
    assert.ok(Number.isFinite(s.durationMinutes) && s.durationMinutes > 0, 'service must have a duration')
    assert.ok(s.category, 'service must have a category')
  }
})

test('Salon Poke defaults include a hair loss treatment service', () => {
  // The brand's signature service is 爆毛術 (hair regrowth). It must be in the fallback.
  const hasHairLoss = defaultServices.some(
    (s) => /爆毛|脫髮|增髮/.test(s.name) || /爆毛|脫髮|增髮/.test(s.description || ''),
  )
  assert.ok(hasHairLoss, 'fallback services must include the hair loss treatment offering')
})
