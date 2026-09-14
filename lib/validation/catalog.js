const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max
const text = (s, min, max) => typeof s === 'string' && s.trim().length >= min && s.trim().length <= max
const ids = value => Array.isArray(value) && value.every(n => integer(n, 1, Number.MAX_SAFE_INTEGER)) && new Set(value).size === value.length
function fields(body, allowed) { if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw new Error('資料格式不正確。') }
export function serviceInput(body) {
  fields(body, ['id','name','price','durationMinutes','category','description','published','sortOrder','staffIds'])
  if (!text(body.name,2,160) || !integer(body.price,0,2147483647) || !integer(body.durationMinutes,15,480) || !text(body.category,1,80) || !text(body.description,0,1200) || typeof body.published !== 'boolean' || !integer(body.sortOrder,-100000,100000) || !ids(body.staffIds)) throw new Error('請檢查服務名稱、價格、時長及員工。')
  return { p_name:body.name.trim(),p_price:body.price,p_duration:body.durationMinutes,p_category:body.category.trim(),p_description:body.description.trim(),p_published:body.published,p_sort_order:body.sortOrder,p_staff_ids:body.staffIds }
}
export function packageInput(body) {
  fields(body,['name','colour_hex','description','total_sessions','validity_days','price_hkd','serviceIds'])
  if (!text(body.name,2,160) || !/^#[0-9a-fA-F]{6}$/.test(body.colour_hex) || !text(body.description,0,1200) || !integer(body.total_sessions,1,10000) || !integer(body.validity_days,1,3650) || !integer(body.price_hkd,0,2147483647) || !ids(body.serviceIds) || !body.serviceIds.length) throw new Error('請檢查套票名稱、價格、次數、有效期及服務。')
  return {p_name:body.name.trim(),p_colour_hex:body.colour_hex,p_description:body.description.trim(),p_total_sessions:body.total_sessions,p_validity_days:body.validity_days,p_price_hkd:body.price_hkd,p_service_ids:body.serviceIds}
}
