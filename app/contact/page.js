import Footer from '../components/Footer'
import Nav from '../components/i18n/Nav'
import BrandIcon from '../components/BrandIcons'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'
import { getServerClient } from '../../lib/supabase/server'
import { publicContact } from '../../lib/content/public-contact.js'

export const metadata = { title: '聯絡我們 | SALON POKE BY VIVA' }

export const dynamic = 'force-dynamic'

export default async function ContactPage() {
  const locale = getLocale()
  let contact = publicContact()
  try {
    const db = await getServerClient()
    const { data } = await db.from('site_content').select('data').eq('id', 1).maybeSingle()
    contact = publicContact(data?.data?.contact)
  } catch {
    // An unavailable CMS must not turn into invented contact details.
  }
  const hasContact = Object.values(contact).some(Boolean)
  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 32 }}>
          {t('contact.title', locale)}
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {contact.address ? <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--gold)' }}>
              <BrandIcon name="leaf" size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>{t('contact.cards.location.title', locale)}</h3>
            <p style={{ color: '#706961' }}>{contact.address}</p>
            {contact.addressNote ? <p style={{ color: '#706961' }}>{contact.addressNote}</p> : null}
          </div> : null}
          {contact.whatsappHref ? <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--gold)' }}>
              <BrandIcon name="chat" size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>{t('contact.cards.whatsapp.title', locale)}</h3>
            <p style={{ color: '#706961', marginBottom: 12 }}>{t('contact.cards.whatsapp.body', locale)}</p>
            <a href={contact.whatsappHref} target="_blank" rel="noopener" className="salon-button">{contact.whatsapp}</a>
          </div> : null}
          {contact.phone ? <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}><h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>電話</h3><a href={`tel:${contact.phone}`} className="salon-button">{contact.phone}</a></div> : null}
          {contact.email ? <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}><h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>電郵</h3><a href={`mailto:${contact.email}`} className="salon-button">{contact.email}</a></div> : null}
          {contact.instagram ? <div style={{ padding: 28, background: '#f7f3ec', borderRadius: 8, textAlign: 'center' }}><h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>Instagram</h3><a href={contact.instagram} target="_blank" rel="noopener" className="salon-button">Instagram</a></div> : null}
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
        {!hasContact ? <p style={{ color: '#706961', marginTop: 32 }}>{locale === 'en' ? 'Contact details are not available yet.' : '聯絡資料暫未提供。'}</p> : null}
        {contact.whatsappHref ? <div style={{ marginTop: 40, textAlign: 'center' }}><a className="salon-button" href={contact.whatsappHref} target="_blank" rel="noopener">{t('contact.cta', locale)}</a></div> : null}
      </main>
      <Footer />
    </div>
  )
}
