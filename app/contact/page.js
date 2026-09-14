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
        <h1 className="present-3eff5205">
          {t('contact.title', locale)}
        </h1>
        <div className="present-a1db41c0">
          {contact.address ? <div className="present-02ec55a0">
            <div className="present-693ad9d2">
              <BrandIcon name="leaf" size={32} />
            </div>
            <h3 className="present-9d645636">{t('contact.cards.location.title', locale)}</h3>
            <p className="present-741dd0c5">{contact.address}</p>
            {contact.addressNote ? <p className="present-741dd0c5">{contact.addressNote}</p> : null}
          </div> : null}
          {contact.whatsappHref ? <div className="present-02ec55a0">
            <div className="present-693ad9d2">
              <BrandIcon name="chat" size={32} />
            </div>
            <h3 className="present-9d645636">{t('contact.cards.whatsapp.title', locale)}</h3>
            <p className="present-933a7750">{t('contact.cards.whatsapp.body', locale)}</p>
            <a href={contact.whatsappHref} target="_blank" rel="noopener" className="salon-button">{contact.whatsapp}</a>
          </div> : null}
          {contact.phone ? <div className="present-02ec55a0"><h3 className="present-9d645636">電話</h3><a href={`tel:${contact.phone}`} className="salon-button">{contact.phone}</a></div> : null}
          {contact.email ? <div className="present-02ec55a0"><h3 className="present-9d645636">電郵</h3><a href={`mailto:${contact.email}`} className="salon-button">{contact.email}</a></div> : null}
          {contact.instagram ? <div className="present-02ec55a0"><h3 className="present-9d645636">Instagram</h3><a href={contact.instagram} target="_blank" rel="noopener" className="salon-button">Instagram</a></div> : null}
          <div className="present-02ec55a0">
            <div className="present-693ad9d2">
              <BrandIcon name="clock" size={32} />
            </div>
            <h3 className="present-9d645636">{t('contact.cards.hours.title', locale)}</h3>
            <p className="present-741dd0c5">
              {t('contact.cards.hours.weekday', locale)}<br />
              {t('contact.cards.hours.closed', locale)}
            </p>
          </div>
        </div>
        {!hasContact ? <p className="present-ed952d49">{locale === 'en' ? 'Contact details are not available yet.' : '聯絡資料暫未提供。'}</p> : null}
        {contact.whatsappHref ? <div className="present-cfb8c16f"><a className="salon-button" href={contact.whatsappHref} target="_blank" rel="noopener">{t('contact.cta', locale)}</a></div> : null}
      </main>
      <Footer />
    </div>
  )
}
