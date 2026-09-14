export function validateCustomerInput(body, { admin = false } = {}) {
  const allowed = admin ? ['name', 'phone', 'email', 'notes'] : ['name', 'phone', 'email']
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw new Error('請檢查客戶資料。')
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = body.phone == null || body.phone === '' ? null : typeof body.phone === 'string' ? body.phone.trim() : false
  const email = body.email == null || body.email === '' ? null : typeof body.email === 'string' ? body.email.trim().toLowerCase() : false
  if (name.length < 2 || name.length > 120 || phone === false || (phone && !/^\+?[0-9 ()-]{7,30}$/.test(phone)) || email === false || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) throw new Error('請輸入有效的姓名、電話及電郵。')
  if (admin && body.notes != null && (typeof body.notes !== 'string' || body.notes.length > 2000)) throw new Error('備註不能超過 2000 字。')
  return { name, phone, email, ...(admin ? { notes: body.notes || '' } : {}) }
}
