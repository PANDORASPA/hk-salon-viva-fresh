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
    'common.password': '密碼',
    'common.email': '電郵',
    'common.required': '*',
    'common.send': '送出',
    'common.loading': '處理中…',

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

    'account.title': '我的帳戶',
    'account.signedIn': '已登入',
    'account.cta.book': '立即預約',
    'account.packages': '我的套票',
    'account.bookings': '我的預約',
    'account.empty.packages': '暫時沒有套票。如有需要，請聯絡我們或到前台購買。',
    'account.empty.bookings': '暫時沒有預約記錄。',
    'account.contact.title': '聯絡我們',
    'account.contact.body': '如有任何關於套票或預約的問題，歡迎聯絡我們。',
    'account.contact.cta': 'WhatsApp 查詢',
    'account.package.expires': '到期',
    'account.package.exhausted': '已用完',
    'account.package.inactive': '已停用',
    'account.package.expired': '已過期',
    'account.package.active': '有效',

    'packages.title': '套票購買',
    'packages.subtitle': '套票可以喺預約時使用，系統會自動扣減一次。完成付款後會喺 1 分鐘內 send WhatsApp 確認。',
    'packages.buy': '立即購買',
    'packages.mockBanner': '測試模式：Stripe 未配置。下單會建立 mock session 而唔會真收費。喺 production 環境要 set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET。',
    'packages.empty': '暫時未有公開套票。請聯絡我哋查詢。',
    'packages.sessionsUnit': '次',
    'packages.daysUnit': '日有效',
    'packages.custom.title': '其他問題',
    'packages.custom.body': '想客製化套票（例如 10 次 / 半年有效 / 多人共享）？請 WhatsApp 我哋：',

    'success.title': '付款成功',
    'success.testNotice': '（測試模式：mock session，套票已即時發行）',
    'success.thanks': '感謝你購買 SALON POKE BY VIVA 套票。',
    'success.transaction': '交易編號',
    'success.ticketId': '套票編號',
    'success.issued': '已發行',
    'success.paid': '已付款',
    'success.failedNotice': '套票自動發行失敗，請聯絡我哋',
    'success.errorTitle': '付款未完成',
    'success.retry': '返回套票頁',
    'success.errorCode': '錯誤代碼',
    'success.tips.0': '套票已自動加入你嘅帳戶，可以即時用嚟預約。',
    'success.tips.1': '預約時輸入同一個電話號碼，系統會自動偵測可用套票並扣減一次。',
    'success.tips.2': '如需取消預約，套票次數會自動退還。',

    'services.title': '服務項目',
    'services.subtitle': '所有服務敬請預約，預約確認後我們會發送詳細地址。',
    'services.cta': 'WhatsApp 查詢及預約',

    'forgot.title': '忘記密碼',
    'forgot.subtitle': '輸入你註冊時用嘅電郵，我哋會 send 一個重設連結俾你。',
    'forgot.cta': 'Send 重設連結',
    'forgot.sent': '✓ 如果該電郵已註冊，重設連結已 send。請檢查 inbox。',
    'forgot.back': '返回登入',

    'reset.title': '設定新密碼',
    'reset.subtitle': '輸入新密碼（最少 8 個字元）。',
    'reset.cta': '更新密碼',
    'reset.success': '✓ 密碼已更新。請用新密碼登入。',

    'footer.copyright': '© 2026 SALON POKE BY VIVA 版權所有',
    'lang.switch': '切換語言',
    'lang.zh-HK': '繁體中文',
    'lang.en': 'English',

    'about.title': '關於我們',
    'about.intro': 'SALON POKE BY VIVA 成立於香港，專注為每一位客人提供專業、貼心的頭髮護理服務。超過20年累積的經驗，令我們對亞洲人髮質有深入了解，能夠提供最適合的造型及修護方案。',
    'about.cards.0.title': '20+ 年經驗',
    'about.cards.0.body': '專業髮型師團隊',
    'about.cards.1.title': '亞洲髮質專家',
    'about.cards.1.body': '了解你的髮絲',
    'about.cards.2.title': '爆毛術技術',
    'about.cards.2.body': '脫髮護理核心',
    'about.cards.3.title': '香港市中心',
    'about.cards.3.body': '便利預約位置',
    'about.treatment.title': '爆毛術 — 我們的核心技術',
    'about.treatment.body': '爆毛術是我們針對脫髮問題研發的專業護理療程，結合深層清潔、營養導入及毛囊激活技術，配合個人化的後續跟進，幫助客人重獲健康濃密的頭髮。',
    'about.treatment.cta': '立即預約評估',

    'contact.title': '聯絡我們',
    'contact.cards.location.title': '香港',
    'contact.cards.location.body': '預約確認後發送確實地址',
    'contact.cards.whatsapp.title': 'WhatsApp',
    'contact.cards.whatsapp.body': '即時回覆，預約更快',
    'contact.cards.hours.title': '營業時間',
    'contact.cards.hours.weekday': '星期一至六 10:00–19:00',
    'contact.cards.hours.closed': '星期日及公眾假期休息',
    'contact.cta': 'WhatsApp 即時查詢',

    'gallery.title': '圖庫',
    'gallery.subtitle': '我們的作品，展示不同造型及護理效果。',
    'gallery.placeholder': '圖庫圖片 {n}',

    'location.title': '位置',
    'location.addressLabel': '香港',
    'location.addressNote': '預約確認後，我們會通過 WhatsApp 發送確實工作室地址。',
    'location.transit.title': '交通',
    'location.transit.items.0': '港鐵直達，步行數分鐘',
    'location.transit.items.1': '周邊有公眾停車場',
    'location.cta': '立即預約',

    'privacy.title': '隱私政策',
    'privacy.updated': '最後更新：2024年1月',
    'privacy.intro': 'SALON POKE BY VIVA（下稱「我們」）承諾保障你的私隱。本政策說明我們如何收集、使用及保護你所提供的個人資料。',
    'privacy.sections.collection.title': '收集的資料',
    'privacy.sections.collection.body': '我們收集姓名、聯絡電話、電郵及預約記錄，以提供預約及服務跟進。',
    'privacy.sections.usage.title': '資料用途',
    'privacy.sections.usage.body': '你的資料僅用於預約確認、服務提醒及客戶服務聯絡，不會用於任何市場推廣或轉交第三方。',
    'privacy.sections.storage.title': '資料儲存',
    'privacy.sections.storage.body': '你的資料儲存於加密的雲端資料庫，並受密碼保護。',
    'privacy.sections.rights.title': '你的權利',
    'privacy.sections.rights.body': '你可隨時要求查閱、更正或刪除你的個人資料。請通過 WhatsApp 或電郵與我們聯絡。',

    'terms.title': '使用條款',
    'terms.updated': '最後更新：2024年1月',
    'terms.sections.booking.title': '預約',
    'terms.sections.booking.body': '所有服務敬請提前預約。預約確認後，我們會發送 WhatsApp 訊息確認時間及地址。',
    'terms.sections.cancellation.title': '取消政策',
    'terms.sections.cancellation.body': '如需取消或更改預約，請最少 24 小時前通知。24 小時內取消可能收取服務費用。',
    'terms.sections.late.title': '遲到',
    'terms.sections.late.body': '遲到超過 30 分鐘，我們可能需要縮短服務時間或重新安排預約。',
    'terms.sections.packages.title': '套票',
    'terms.sections.packages.body': '套票有效期由購買日起計算，逾期未使用的次數將不予退款或延期。',
    'terms.sections.payment.title': '付款',
    'terms.sections.payment.body': '服務費用於到店時支付。我們接受現金及轉帳。',
    'terms.sections.privacy.title': '私隱',
    'terms.sections.privacy.body': '我們會妥善保管你的個人資料，僅用於預約及服務聯絡用途。',
  },

  en: {
    'common.brand': 'SALON POKE BY VIVA',
    'common.tagline': 'Hair loss regrowth specialists',
    'common.eyebrow': 'Hong Kong · By appointment',
    'common.skipToContent': 'Skip to content',
    'common.minutes': ' min',
    'common.password': 'Password',
    'common.email': 'Email',
    'common.required': '*',
    'common.send': 'Send',
    'common.loading': 'Loading…',

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

    'account.title': 'My account',
    'account.signedIn': 'Signed in as',
    'account.cta.book': 'Book now',
    'account.packages': 'My packages',
    'account.bookings': 'My bookings',
    'account.empty.packages': 'You have no packages yet. Contact us or visit the salon to purchase one.',
    'account.empty.bookings': 'No bookings yet.',
    'account.contact.title': 'Contact us',
    'account.contact.body': 'For any questions about packages or bookings, please get in touch.',
    'account.contact.cta': 'WhatsApp us',
    'account.package.expires': 'expires',
    'account.package.exhausted': 'Used up',
    'account.package.inactive': 'Inactive',
    'account.package.expired': 'Expired',
    'account.package.active': 'Active',

    'packages.title': 'Buy a package',
    'packages.subtitle': 'Use a package at booking time and the system debits one session automatically. We will WhatsApp you a confirmation within 1 minute of payment.',
    'packages.buy': 'Buy now',
    'packages.mockBanner': 'Test mode: Stripe is not configured. Orders will create a mock session and not charge. In production, set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET.',
    'packages.empty': 'No public packages right now. Please contact us to enquire.',
    'packages.sessionsUnit': ' sessions',
    'packages.daysUnit': ' day validity',
    'packages.custom.title': 'Other questions',
    'packages.custom.body': 'Need a custom package (e.g. 10 sessions / 6-month validity / shared)? WhatsApp us:',

    'success.title': 'Payment successful',
    'success.testNotice': '(Test mode: mock session, package issued immediately)',
    'success.thanks': 'Thank you for buying a SALON POKE BY VIVA package.',
    'success.transaction': 'Transaction ID',
    'success.ticketId': 'Package ID',
    'success.issued': 'Issued',
    'success.paid': 'Paid',
    'success.failedNotice': 'Package could not be auto-issued. Please contact us.',
    'success.errorTitle': 'Payment incomplete',
    'success.retry': 'Back to packages',
    'success.errorCode': 'Error code',
    'success.tips.0': 'The package is now in your account and can be used for booking immediately.',
    'success.tips.1': 'Use the same phone number at booking time and the system will pick up the package automatically.',
    'success.tips.2': 'Cancelling a package booking refunds the session automatically.',

    'services.title': 'Services',
    'services.subtitle': 'All services are by appointment. After confirmation we will send the detailed address.',
    'services.cta': 'WhatsApp to enquire / book',

    'forgot.title': 'Forgot password',
    'forgot.subtitle': 'Enter the email you used at sign-up and we will send a reset link.',
    'forgot.cta': 'Send reset link',
    'forgot.sent': '✓ If that email is registered, a reset link has been sent. Please check your inbox.',
    'forgot.back': 'Back to sign in',

    'reset.title': 'Set a new password',
    'reset.subtitle': 'Choose a new password (at least 8 characters).',
    'reset.cta': 'Update password',
    'reset.success': '✓ Password updated. Please sign in with the new password.',

    'footer.copyright': '© 2026 SALON POKE BY VIVA. All rights reserved.',
    'lang.switch': 'Language',
    'lang.zh-HK': '繁體中文',
    'lang.en': 'English',

    'about.title': 'About us',
    'about.intro': 'Founded in Hong Kong, SALON POKE BY VIVA is dedicated to providing professional, attentive hair care for every guest. With more than 20 years of experience, we understand Asian hair deeply and offer the styling and restorative treatments that suit it best.',
    'about.cards.0.title': '20+ years',
    'about.cards.0.body': 'Senior stylists',
    'about.cards.1.title': 'Asian hair experts',
    'about.cards.1.body': 'We know your hair',
    'about.cards.2.title': 'Hair regrowth',
    'about.cards.2.body': 'Our core program',
    'about.cards.3.title': 'Central Hong Kong',
    'about.cards.3.body': 'Easy to reach',
    'about.treatment.title': 'Poke Regrowth — our signature program',
    'about.treatment.body': 'Poke Regrowth is our targeted hair-loss treatment: deep cleanse, nutrient infusion and follicle activation combined with personalised follow-up, so every guest can grow back thicker, healthier hair.',
    'about.treatment.cta': 'Book a free assessment',

    'contact.title': 'Contact us',
    'contact.cards.location.title': 'Hong Kong',
    'contact.cards.location.body': 'Exact address sent after booking confirmation',
    'contact.cards.whatsapp.title': 'WhatsApp',
    'contact.cards.whatsapp.body': 'Fastest way to reach us',
    'contact.cards.hours.title': 'Opening hours',
    'contact.cards.hours.weekday': 'Mon – Sat 10:00 – 19:00',
    'contact.cards.hours.closed': 'Sun & public holidays: closed',
    'contact.cta': 'Message us on WhatsApp',

    'gallery.title': 'Gallery',
    'gallery.subtitle': 'A selection of our styling and care work.',
    'gallery.placeholder': 'Gallery image {n}',

    'location.title': 'Location',
    'location.addressLabel': 'Hong Kong',
    'location.addressNote': 'Once your booking is confirmed, we will share the exact studio address via WhatsApp.',
    'location.transit.title': 'Getting here',
    'location.transit.items.0': 'Direct MTR access, a few minutes walk',
    'location.transit.items.1': 'Public parking nearby',
    'location.cta': 'Book now',

    'privacy.title': 'Privacy policy',
    'privacy.updated': 'Last updated: January 2024',
    'privacy.intro': 'SALON POKE BY VIVA ("we") is committed to protecting your privacy. This policy explains what personal data we collect, how we use it, and how we keep it safe.',
    'privacy.sections.collection.title': 'What we collect',
    'privacy.sections.collection.body': 'We collect your name, phone number, email and booking history so we can confirm appointments and follow up on services.',
    'privacy.sections.usage.title': 'How we use it',
    'privacy.sections.usage.body': 'Your data is used only for booking confirmations, service reminders and customer-care follow-up. We never use it for marketing and never share it with third parties.',
    'privacy.sections.storage.title': 'How we store it',
    'privacy.sections.storage.body': 'Your data lives in an encrypted, password-protected cloud database.',
    'privacy.sections.rights.title': 'Your rights',
    'privacy.sections.rights.body': 'You can request access, correction or deletion of your personal data at any time. Please reach us via WhatsApp or email.',

    'terms.title': 'Terms of use',
    'terms.updated': 'Last updated: January 2024',
    'terms.sections.booking.title': 'Bookings',
    'terms.sections.booking.body': 'All services are by appointment. Once a booking is confirmed, we will send the time and address via WhatsApp.',
    'terms.sections.cancellation.title': 'Cancellation',
    'terms.sections.cancellation.body': 'To reschedule or cancel, please give us at least 24 hours notice. Cancellations inside 24 hours may incur a service charge.',
    'terms.sections.late.title': 'Late arrival',
    'terms.sections.late.body': 'If you arrive more than 30 minutes late, we may need to shorten the service or reschedule.',
    'terms.sections.packages.title': 'Packages',
    'terms.sections.packages.body': 'Package validity starts on the purchase date. Unused sessions are not refundable or extendable past the expiry.',
    'terms.sections.payment.title': 'Payment',
    'terms.sections.payment.body': 'Service fees are paid in studio. We accept cash and bank transfer.',
    'terms.sections.privacy.title': 'Privacy',
    'terms.sections.privacy.body': 'We keep your personal data safe and use it only for bookings and service follow-up.',
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
