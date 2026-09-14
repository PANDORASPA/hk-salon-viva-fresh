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
