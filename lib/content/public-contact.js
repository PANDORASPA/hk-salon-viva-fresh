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
  const whatsappDigits = text(input.whatsapp, 32)?.replace(/[^0-9]/g, '') || null
  const whatsapp = whatsappDigits && whatsappDigits.length >= 7 && whatsappDigits.length <= 15 ? whatsappDigits : null
  const phone = text(input.phone, 40)
  const email = text(input.email, 254)
  return {
    whatsapp,
    whatsappHref: whatsapp ? `https://wa.me/${whatsapp}` : null,
    phone: phone && /^[+0-9()\s-]{7,40}$/.test(phone) ? phone : null,
    email: email && EMAIL.test(email) ? email : null,
    instagram: httpsUrl(input.instagram),
    address: text(input.address),
    addressNote: text(input.addressNote),
  }
}

export function publicSiteUrl(value) {
  return httpsUrl(value)?.replace(/\/$/, '') || null
}
