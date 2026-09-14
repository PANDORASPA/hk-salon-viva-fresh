const HONG_KONG = 'Asia/Hong_Kong'

export function hongKongDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HONG_KONG,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value)
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function formatHongKongDateTime(value) {
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: HONG_KONG,
    dateStyle: 'medium', timeStyle: 'short', hour12: false,
  }).format(new Date(value))
}
