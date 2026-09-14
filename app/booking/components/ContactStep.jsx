'use client'

import Link from 'next/link'

export default function ContactStep({ contact, authenticated, onChange }) {
  return (
    <section aria-labelledby="booking-contact-title">
      <h2 id="booking-contact-title" className="booking-wizard-title">聯絡方式</h2>
      {authenticated ? (
        <p className="booking-wizard-intro">登入帳戶後可在下一步選擇可用套票。</p>
      ) : (
        <p className="booking-wizard-intro">你可自費預約；如有套票，請先 <Link href="/signin?next=/booking">登入帳戶</Link> 使用。</p>
      )}
      <div className="booking-fields">
        <div className="booking-field">
          <label htmlFor="booking-name">姓名</label>
          <input id="booking-name" autoComplete="name" value={contact.name} onChange={(event) => onChange({ name: event.target.value })} />
        </div>
        <div className="booking-field">
          <label htmlFor="booking-phone">電話</label>
          <input id="booking-phone" type="tel" autoComplete="tel" value={contact.phone} onChange={(event) => onChange({ phone: event.target.value })} />
        </div>
        <div className="booking-field">
          <label htmlFor="booking-email">電郵（選填）</label>
          <input id="booking-email" type="email" autoComplete="email" value={contact.email} onChange={(event) => onChange({ email: event.target.value })} />
        </div>
      </div>
    </section>
  )
}
