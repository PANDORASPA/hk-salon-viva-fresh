export function toHkdInput(cents) {
  const value = Number(cents)
  if (!Number.isSafeInteger(value) || value < 0) return ''
  return String(value / 100)
}

export function fromHkdInput(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null
  const cents = Math.round(Number(text) * 100)
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null
}
