import Link from 'next/link'
import Footer from '../components/Footer'
import Nav from '../components/i18n/Nav'
import BrandIcon from '../components/BrandIcons'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'
import { getServerClient } from '../../lib/supabase/server'
import { publicContact } from '../../lib/content/public-contact.js'

export const metadata = { title: '位置 | SALON POKE BY VIVA' }

export const dynamic = 'force-dynamic'

export default async function LocationPage() {
  const locale = getLocale()
  let contact = publicContact()
  try {
    const db = await getServerClient()
    const { data } = await db.from('site_content').select('data').eq('id', 1).maybeSingle()
    contact = publicContact(data?.data?.contact)
  } catch {
    // Leave location unavailable rather than publishing an unverifiable area.
  }
  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 24 }}>
          {t('location.title', locale)}
        </h1>
        {contact.address ? <div style={{ padding: 32, background: '#f7f3ec', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'var(--gold)' }}><BrandIcon name="leaf" size={28} /></span>
          <div>
            <p style={{ fontSize: 18, margin: '0 0 4px' }}>{contact.address}</p>
            {contact.addressNote ? <p style={{ color: '#706961', margin: 0 }}>{contact.addressNote}</p> : null}
          </div>
        </div> : <p style={{ color: '#706961' }}>{locale === 'en' ? 'Location details are not available yet.' : '位置資料暫未提供。'}</p>}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link className="salon-button" href="/booking">{t('location.cta', locale)}</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
