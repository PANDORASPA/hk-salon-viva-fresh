const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(value, maximum = 500) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= maximum ? trimmed : null
}

function httpsUrl(value) {
  const candidate = text(value, 2_000)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function publicContact(source) {
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {}
  const whatsapp = publicPhone(input.whatsapp)?.replace(/[^0-9]/g, '') || null
  const phone = publicPhone(input.phone)
  const email = text(input.email, 254)
  return {
    whatsapp,
    whatsappHref: whatsapp ? `https://wa.me/${whatsapp}` : null,
    phone,
    email: email && EMAIL.test(email) ? email : null,
    instagram: httpsUrl(input.instagram),
    address: text(input.address),
    addressNote: text(input.addressNote),
  }
}

export function publicPhone(value) {
  const candidate = text(value, 40)
  if (!candidate || !/^\+?[0-9][0-9()\s-]*$/.test(candidate)) return null
  const digits = candidate.replace(/[^0-9]/g, '')
  return digits.length >= 7 && digits.length <= 15 ? candidate : null
}

export function publicSiteUrl(value) {
  return httpsUrl(value)?.replace(/\/$/, '') || null
}

export function validateManagedContent(input) {
  const schema = {
    identity: { name: 160, shortName: 160, tagline: 500, eyebrow: 500, heroTitle: 500, heroBody: 5000 },
    contact: { phone: 40, email: 254, whatsapp: 40, instagram: 2000, address: 500, addressNote: 500 },
    business: { openDays: 500, hours: 500, closedDays: 500 },
  }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !Object.hasOwn(schema, key))) throw new Error('網站內容格式不正確。')
  const output = {}
  for (const [group, values] of Object.entries(input)) {
    if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(key => !Object.hasOwn(schema[group], key))) throw new Error('網站欄位不正確。')
    output[group] = {}
    for (const [key, value] of Object.entries(values)) {
      if (value !== null && (typeof value !== 'string' || value.length > schema[group][key])) throw new Error('網站內容超出長度或格式限制。')
      const clean = value?.trim() || null
      if (group === 'contact' && clean && ((['phone', 'whatsapp'].includes(key) && !publicPhone(clean)) || (key === 'email' && !EMAIL.test(clean)) || (key === 'instagram' && !httpsUrl(clean)))) throw new Error('請輸入有效電話、電郵或 HTTPS 網址。')
      if (group === 'identity' && key === 'name' && !clean) throw new Error('請填寫店舖名稱。')
      output[group][key] = clean
    }
  }
  return output
}
