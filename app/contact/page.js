import Link from 'next/link'
import Footer from '../components/Footer'
import Nav from '../components/i18n/Nav'
import BrandIcon from '../components/BrandIcons'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'
import { salonDefaults } from '../../content/salon-poke-defaults'

export const metadata = { title: '聯絡我們 | SALON POKE BY VIVA' }

export const dynamic = 'force-dynamic'

export default function ContactPage() {
  const locale = getLocale()
  const whatsapp = salonDefaults.contact.whatsapp
  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 32 }}>
          {t('contact.title', locale)}
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--gold)' }}>
              <BrandIcon name="leaf" size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>{t('contact.cards.location.title', locale)}</h3>
            <p style={{ color: '#706961' }}>{t('contact.cards.location.body', locale)}</p>
          </div>
          <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--gold)' }}>
              <BrandIcon name="chat" size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>{t('contact.cards.whatsapp.title', locale)}</h3>
            <p style={{ color: '#706961', marginBottom: 12 }}>{t('contact.cards.whatsapp.body', locale)}</p>
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener" className="salon-button">{whatsapp}</a>
          </div>
          <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--gold)' }}>
              <BrandIcon name="clock" size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>{t('contact.cards.hours.title', locale)}</h3>
            <p style={{ color: '#706961' }}>
              {t('contact.cards.hours.weekday', locale)}<br />
              {t('contact.cards.hours.closed', locale)}
            </p>
          </div>
        </div>
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a className="salon-button" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">
            {t('contact.cta', locale)}
          </a>
        </div>
      </main>
      <Footer />
    </div>
  )
}
