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
        <h1 className="present-4f80823c">
          {t('location.title', locale)}
        </h1>
        {contact.address ? <div className="present-2c4feb5c">
          <span className="present-07e3cdd3"><BrandIcon name="leaf" size={28} /></span>
          <div>
            <p className="present-c3fd0dc1">{contact.address}</p>
            {contact.addressNote ? <p className="present-64fbd8bc">{contact.addressNote}</p> : null}
          </div>
        </div> : <p className="present-741dd0c5">{locale === 'en' ? 'Location details are not available yet.' : '位置資料暫未提供。'}</p>}
        <div className="present-8173c779">
          <Link className="salon-button" href="/booking">{t('location.cta', locale)}</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
