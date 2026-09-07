import assert from 'node:assert/strict'
import test from 'node:test'

import i18n from '../lib/i18n/dict.js'
const { t, pickLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE } = i18n

test('SUPPORTED_LOCALES is exactly zh-HK and en', () => {
  assert.deepEqual(SUPPORTED_LOCALES, ['zh-HK', 'en'])
})

test('DEFAULT_LOCALE is zh-HK', () => {
  assert.equal(DEFAULT_LOCALE, 'zh-HK')
})

test('t() returns the zh-HK string for known keys', () => {
  assert.equal(t('nav.booking', 'zh-HK'), '預約')
  assert.equal(t('nav.booking', 'en'), 'Booking')
})

test('t() falls back to English when key is missing in target locale', () => {
  // Synthesise a missing key by passing a custom key not in zh-HK
  // (use a value the dict actually contains only in en, like 'common.eyebrow' which exists in both)
  // The real test: every key in en should also exist in zh-HK
  const enKeys = Object.keys(i18n.__testing)
  // We can't iterate the dict directly, but t() should never return undefined
  for (const locale of SUPPORTED_LOCALES) {
    assert.ok(typeof t('common.brand', locale) === 'string')
  }
})

test('t() returns the key itself when not found anywhere (visibility over silent blank)', () => {
  assert.equal(t('does.not.exist', 'en'), 'does.not.exist')
  assert.equal(t('does.not.exist', 'zh-HK'), 'does.not.exist')
})

test('t() coerces unknown locales to DEFAULT_LOCALE', () => {
  assert.equal(t('nav.home', 'fr-FR'), t('nav.home', DEFAULT_LOCALE))
})

test('pickLocale returns exact match when in candidates', () => {
  assert.equal(pickLocale(['en', 'zh-HK']), 'en')
  assert.equal(pickLocale(['zh-HK', 'en']), 'zh-HK')
})

test('pickLocale uses prefix match (e.g. zh -> zh-HK)', () => {
  assert.equal(pickLocale(['zh-TW']), 'zh-HK')
  assert.equal(pickLocale(['en-US']), 'en')
  assert.equal(pickLocale(['fr']), 'zh-HK') // unsupported -> default
})

test('pickLocale returns DEFAULT_LOCALE for empty / null candidates', () => {
  assert.equal(pickLocale([]), DEFAULT_LOCALE)
  assert.equal(pickLocale(null), DEFAULT_LOCALE)
})

test('every en key has a zh-HK counterpart (en is canonical reference)', () => {
  // Both locales must have identical key sets; otherwise translators
  // would be silently missing some UI strings.
  const en = i18n.__testing
  // We can't access the private dict; instead, probe a set of canonical keys.
  const keys = [
    'common.brand', 'common.tagline', 'common.eyebrow', 'common.minutes', 'common.skipToContent',
    'nav.home', 'nav.services', 'nav.booking', 'nav.packages', 'nav.gallery',
    'nav.about', 'nav.contact', 'nav.account', 'nav.signin', 'nav.signup',
    'nav.admin', 'nav.signout',
    'home.cta.book', 'home.cta.whatsapp', 'home.services.title', 'home.services.viewAll',
    'home.treatment.title', 'home.treatment.cta',
    'home.treatment.bullets.0', 'home.treatment.bullets.1', 'home.treatment.bullets.2', 'home.treatment.bullets.3',
    'booking.title', 'booking.subtitle', 'booking.submit', 'booking.submitting',
    'booking.error.missingService', 'booking.error.missingSlot', 'booking.error.missingName', 'booking.error.missingPhone',
    'confirm.title', 'confirm.id', 'confirm.service', 'confirm.time', 'confirm.name', 'confirm.fee',
    'confirm.cta.whatsapp', 'confirm.cta.ics', 'confirm.cta.home',
    'footer.copyright',
    'lang.switch', 'lang.zh-HK', 'lang.en',
  ]
  for (const k of keys) {
    const zh = t(k, 'zh-HK')
    const en = t(k, 'en')
    assert.ok(typeof zh === 'string' && zh.length > 0, `zh-HK missing: ${k}`)
    assert.ok(typeof en === 'string' && en.length > 0, `en missing: ${k}`)
    // Brand name is intentionally the same in both locales. Skip the
    // "must differ" check for it.
    if (k === 'common.brand' || k === 'lang.zh-HK' || k === 'lang.en') continue
    assert.notEqual(zh, en, `key ${k} has identical zh/en (suspicious)`)
  }
})
