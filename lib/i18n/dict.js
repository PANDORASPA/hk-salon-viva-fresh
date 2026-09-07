/**
 * i18n dictionary + helpers.
 *
 * The site ships with `zh-HK` as the default. English (`en`) is a
 * secondary locale for international customers.
 *
 * Convention:
 *   - Keys use dot notation: `nav.services`, `booking.submit`
 *   - Missing keys fall back to the English string (so `en` is always
 *     populated) and then to the key itself (so untranslated values are
 *     visible during development rather than silently blank).
 *   - All keys MUST exist in `en` so it can act as the canonical reference.
 */

export const SUPPORTED_LOCALES = ['zh-HK', 'en']
export const DEFAULT_LOCALE = 'zh-HK'

const dict = {
  'zh-HK': {
    'common.brand': 'SALON POKE BY VIVA',
    'common.tagline': '爆毛術脫髮護理',
    'common.eyebrow': '香港 · 敬請預約',
    'common.skipToContent': '跳到主要內容',
    'common.minutes': ' 分鐘',

    'nav.home': '主頁',
    'nav.services': '服務',
    'nav.booking': '預約',
    'nav.packages': '套票',
    'nav.gallery': '圖庫',
    'nav.about': '關於',
    'nav.contact': '聯絡',
    'nav.account': '我的帳戶',
    'nav.signin': '登入',
    'nav.signup': '註冊',
    'nav.admin': '管理後台',
    'nav.signout': '登出',

    'home.stats.experience.value': '20+',
    'home.stats.experience.label': '年經驗',
    'home.stats.specialty.value': '亞洲',
    'home.stats.specialty.label': '髮質專家',
    'home.stats.location.value': '香港',
    'home.stats.location.label': '市中心',
    'home.services.title': '服務項目',
    'home.services.viewAll': '查看全部服務',
    'home.cta.book': '立即預約',
    'home.cta.whatsapp': 'WhatsApp 查詢',
    'home.treatment.title': '爆毛術護理',
    'home.treatment.bullets.0': '專業脫髮評估及分析',
    'home.treatment.bullets.1': '個人化護理方案',
    'home.treatment.bullets.2': '深層清潔及滋養',
    'home.treatment.bullets.3': '追蹤進度及調整',
    'home.treatment.cta': '查詢爆毛術療程',

    'booking.title': '預約服務',
    'booking.subtitle': '填寫以下資料，我們會盡快確認你的預約。',
    'booking.phone.label': '電話號碼 *',
    'booking.phone.placeholder': '例：91234567',
    'booking.lookup.searching': '查詢中…',
    'booking.lookup.found': '找到客戶',
    'booking.lookup.notFound': '這是新客戶，請填寫姓名繼續',
    'booking.lookup.error': '客戶查詢失敗，請稍後再試',
    'booking.package.use': '使用套票',
    'booking.package.none': '不使用套票',
    'booking.package.selfPay': '自費付款',
    'booking.package.expire': '到期',
    'booking.service.title': '選擇服務',
    'booking.service.otherPay': '其他服務（自費）',
    'booking.datetime.title': '選擇日期及時間',
    'booking.datetime.date': '日期',
    'booking.datetime.hint': '可選時段（已屏蔽已被預約的時間）：',
    'booking.datetime.empty': '當日無可預約時段，請選擇其他日期',
    'booking.datetime.loading': '載入時段中…',
    'booking.contact.title': '聯絡方式',
    'booking.contact.name': '姓名 *',
    'booking.contact.namePlaceholder': '你的姓名',
    'booking.contact.email': '電郵（選填）',
    'booking.contact.emailPlaceholder': 'example@email.com',
    'booking.submit': '✓ 確認預約',
    'booking.submitting': '提交中…',
    'booking.error.missingService': '請選擇服務',
    'booking.error.missingSlot': '請選擇日期及時段',
    'booking.error.missingName': '請填寫姓名',
    'booking.error.missingPhone': '請填寫電話',

    'confirm.title': '預約已確認',
    'confirm.notFoundTitle': '查詢預約',
    'confirm.id': '預約編號',
    'confirm.service': '服務',
    'confirm.time': '時間',
    'confirm.timezone': '香港時間 (Asia/Hong_Kong)',
    'confirm.name': '姓名',
    'confirm.fee': '費用',
    'confirm.payOnSite': '現場付款',
    'confirm.cta.whatsapp': 'WhatsApp 確認',
    'confirm.cta.ics': '加入日曆 (.ics)',
    'confirm.cta.home': '返回首頁',
    'confirm.success': '我們已收到你的預約申請，我們會盡快透過 WhatsApp 或致電確認。',
    'confirm.tips.0': '請於預約時間 5 分鐘前到達工作室。',
    'confirm.tips.1': '如需改期或取消，請最少提前 24 小時通知我們。',
    'confirm.tips.2': '使用套票預約，系統會自動扣減一次。如需取消，套票次數會自動退還。',

    'footer.copyright': '© 2026 SALON POKE BY VIVA 版權所有',
    'lang.switch': '切換語言',
    'lang.zh-HK': '繁體中文',
    'lang.en': 'English',
  },

  'en': {
    'common.brand': 'SALON POKE BY VIVA',
    'common.tagline': 'Hair loss regrowth specialists',
    'common.eyebrow': 'Hong Kong · By appointment',
    'common.skipToContent': 'Skip to content',
    'common.minutes': ' min',

    'nav.home': 'Home',
    'nav.services': 'Services',
    'nav.booking': 'Booking',
    'nav.packages': 'Packages',
    'nav.gallery': 'Gallery',
    'nav.about': 'About',
    'nav.contact': 'Contact',
    'nav.account': 'Account',
    'nav.signin': 'Sign in',
    'nav.signup': 'Sign up',
    'nav.admin': 'Admin',
    'nav.signout': 'Sign out',

    'home.stats.experience.value': '20+',
    'home.stats.experience.label': 'Years',
    'home.stats.specialty.value': 'Asian',
    'home.stats.specialty.label': 'Hair expert',
    'home.stats.location.value': 'HK',
    'home.stats.location.label': 'Central',
    'home.services.title': 'Services',
    'home.services.viewAll': 'View all services',
    'home.cta.book': 'Book now',
    'home.cta.whatsapp': 'WhatsApp',
    'home.treatment.title': 'Hair regrowth treatment',
    'home.treatment.bullets.0': 'Professional hair loss assessment',
    'home.treatment.bullets.1': 'Personalised care plan',
    'home.treatment.bullets.2': 'Deep cleanse + nourishment',
    'home.treatment.bullets.3': 'Progress tracking + adjustment',
    'home.treatment.cta': 'Ask about our regrowth program',

    'booking.title': 'Book a service',
    'booking.subtitle': 'Fill in the form and we will confirm your appointment shortly.',
    'booking.phone.label': 'Phone number *',
    'booking.phone.placeholder': 'e.g. 9123 4567',
    'booking.lookup.searching': 'Searching…',
    'booking.lookup.found': 'Found customer',
    'booking.lookup.notFound': 'New customer — please fill in your name to continue',
    'booking.lookup.error': 'Lookup failed, please try again',
    'booking.package.use': 'Use a package',
    'booking.package.none': 'No package',
    'booking.package.selfPay': 'Pay yourself',
    'booking.package.expire': 'Expires',
    'booking.service.title': 'Choose a service',
    'booking.service.otherPay': 'Other services (pay yourself)',
    'booking.datetime.title': 'Date and time',
    'booking.datetime.date': 'Date',
    'booking.datetime.hint': 'Available slots (booked times are hidden):',
    'booking.datetime.empty': 'No available slots on this date. Please pick another day.',
    'booking.datetime.loading': 'Loading slots…',
    'booking.contact.title': 'Contact',
    'booking.contact.name': 'Name *',
    'booking.contact.namePlaceholder': 'Your name',
    'booking.contact.email': 'Email (optional)',
    'booking.contact.emailPlaceholder': 'example@email.com',
    'booking.submit': '✓ Confirm booking',
    'booking.submitting': 'Submitting…',
    'booking.error.missingService': 'Please choose a service',
    'booking.error.missingSlot': 'Please choose a date and slot',
    'booking.error.missingName': 'Please enter your name',
    'booking.error.missingPhone': 'Please enter your phone',

    'confirm.title': 'Booking confirmed',
    'confirm.notFoundTitle': 'View booking',
    'confirm.id': 'Booking ID',
    'confirm.service': 'Service',
    'confirm.time': 'Time',
    'confirm.timezone': 'Hong Kong Time (Asia/Hong_Kong)',
    'confirm.name': 'Name',
    'confirm.fee': 'Fee',
    'confirm.payOnSite': 'Pay on site',
    'confirm.cta.whatsapp': 'Confirm via WhatsApp',
    'confirm.cta.ics': 'Add to calendar (.ics)',
    'confirm.cta.home': 'Back to home',
    'confirm.success': 'We received your booking request and will confirm via WhatsApp or phone shortly.',
    'confirm.tips.0': 'Please arrive 5 minutes before your appointment.',
    'confirm.tips.1': 'To reschedule or cancel, please give us at least 24 hours notice.',
    'confirm.tips.2': 'Package redemptions are automatic. Cancelling a booking refunds the session.',

    'footer.copyright': '© 2026 SALON POKE BY VIVA. All rights reserved.',
    'lang.switch': 'Language',
    'lang.zh-HK': '繁體中文',
    'lang.en': 'English',
  },
}

/**
 * Translate a key. Falls back to English, then to the key itself.
 *
 * @param {string} key
 * @param {'zh-HK'|'en'} locale
 * @returns {string}
 */
export function t(key, locale = DEFAULT_LOCALE) {
  const safe = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
  const primary = dict[safe]?.[key]
  if (primary !== undefined) return primary
  const fallback = dict[DEFAULT_LOCALE === safe ? 'en' : DEFAULT_LOCALE]?.[key]
  if (fallback !== undefined) return fallback
  return key
}

/**
 * Pick the best locale from a list of candidates (e.g. Accept-Language).
 * Returns DEFAULT_LOCALE if no candidate matches.
 *
 * Match priority for each candidate:
 *   1. exact match in SUPPORTED_LOCALES
 *   2. exact match of the language prefix (e.g. 'en' matches 'en')
 *   3. prefix-with-region match (e.g. 'zh-TW' matches 'zh-HK')
 */
export function pickLocale(candidates) {
  if (!candidates || !candidates.length) return DEFAULT_LOCALE
  for (const raw of candidates) {
    const c = String(raw).trim()
    if (!c) continue
    if (SUPPORTED_LOCALES.includes(c)) return c
    const prefix = c.split('-')[0].toLowerCase()
    if (!prefix) continue
    const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === prefix)
    if (exact) return exact
    const withRegion = SUPPORTED_LOCALES.find((l) => l.toLowerCase().startsWith(prefix + '-'))
    if (withRegion) return withRegion
  }
  return DEFAULT_LOCALE
}

export const __testing = { t, pickLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE }

export default { t, pickLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE, __testing }
