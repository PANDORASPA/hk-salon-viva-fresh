import { getServerClient } from '../../lib/supabase/server'
import BookingForm from './BookingForm'
import { defaultServices } from '../../content/salon-poke-defaults'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = { title: '預約 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function BookingPage() {
  const locale = getLocale()
  const db = await getServerClient()
  const { data: services } = await db
    .from('services')
    .select('id, name, price, duration_minutes, category')
    .eq('published', true).eq('enabled', true)
    .order('sort_order')

  const svcList = services?.length ? services : defaultServices.map(s => ({
    ...s, id: s.name, price: s.pricePence, duration_minutes: s.durationMinutes,
  }))

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ marginBottom: 8, textAlign: 'left' }}>
          {t('booking.title', locale)}
        </h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>
          {t('booking.subtitle', locale)}
        </p>
        <BookingForm services={svcList} />
      </main>
    </div>
  )
}
