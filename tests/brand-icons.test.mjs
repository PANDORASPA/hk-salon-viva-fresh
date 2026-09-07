import assert from 'node:assert/strict'
import test from 'node:test'

import { __testing, default as BrandIcon } from '../app/components/BrandIcons.js'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { iconForCategory, BRAND_ICON_NAMES } = __testing

test('iconForCategory returns a known icon for known categories', () => {
  assert.equal(iconForCategory('Haircut'), 'scissors')
  assert.equal(iconForCategory('剪髮'), 'scissors')
  assert.equal(iconForCategory('Colour'), 'drop')
  assert.equal(iconForCategory('染髮'), 'drop')
  assert.equal(iconForCategory('Perm'), 'spark')
  assert.equal(iconForCategory('Treatment'), 'leaf')
  assert.equal(iconForCategory('深層護理'), 'leaf')
  assert.equal(iconForCategory('Blow Dry'), 'comb')
  assert.equal(iconForCategory('造型'), 'comb')
})

test('iconForCategory falls back to scissors for unknowns', () => {
  assert.equal(iconForCategory(null), 'scissors')
  assert.equal(iconForCategory(undefined), 'scissors')
  assert.equal(iconForCategory(''), 'scissors')
  assert.equal(iconForCategory('Something brand new'), 'scissors')
})

test('BRAND_ICON_NAMES has the expected set', () => {
  assert.ok(BRAND_ICON_NAMES.includes('scissors'))
  assert.ok(BRAND_ICON_NAMES.includes('leaf'))
  assert.ok(BRAND_ICON_NAMES.includes('drop'))
  assert.ok(BRAND_ICON_NAMES.includes('spark'))
  assert.ok(BRAND_ICON_NAMES.includes('comb'))
  assert.ok(BRAND_ICON_NAMES.includes('hair'))
})

test('BrandIcon renders a labelled svg', () => {
  const html = renderToStaticMarkup(React.createElement(BrandIcon, { name: 'leaf', size: 32, label: 'Leaf' }))
  assert.ok(html.startsWith('<svg'))
  assert.ok(html.includes('viewBox="0 0 24 24"'))
  assert.ok(html.includes('width="32"'))
  assert.ok(html.includes('height="32"'))
  assert.ok(html.includes('aria-label="Leaf"'))
  assert.ok(html.includes('role="img"'))
})

test('BrandIcon is aria-hidden when no label is supplied', () => {
  const html = renderToStaticMarkup(React.createElement(BrandIcon, { name: 'scissors' }))
  assert.ok(html.includes('aria-hidden="true"'))
  assert.ok(!html.includes('role="img"'))
})

test('BrandIcon falls back to scissors for unknown names', () => {
  const html = renderToStaticMarkup(React.createElement(BrandIcon, { name: 'unicorn' }))
  // scissors path: two circles + two lines
  assert.ok(html.includes('cx="6"'))
  assert.ok(html.includes('cx="6" cy="17"'))
})

test('BrandIcon honours className', () => {
  const html = renderToStaticMarkup(React.createElement(BrandIcon, { name: 'leaf', className: 'salon-bullet-icon' }))
  assert.ok(html.includes('salon-bullet-icon'))
  assert.ok(html.includes('brand-icon'))
})
