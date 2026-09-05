import { getServerClient } from '../../lib/supabase/server'
import BookingForm from './BookingForm'
import { defaultServices } from '../../content/salon-poke-defaults'

export const metadata = { title: '預約 | SALON POKE BY VIVA' }

export default async function BookingPage() {
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
      <header className="salon-nav">
        <div className="salon-wrap">
          <nav>
            <a href="/">SALON POKE</a>
            <a href="/services">服務</a>
            <a href="/booking">預約</a>
            <a href="/gallery">圖庫</a>
            <a href="/about">關於</a>
            <a href="/contact">聯絡</a>
          </nav>
        </div>
      </header>
      <main className="salon-wrap salon-section">
        <h1 style={{ font: '600 42px/1.1 Georgia,serif', marginBottom: 8 }}>預約服務</h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>填寫以下資料，我們會盡快確認你的預約。</p>
        <BookingForm services={svcList} />
      </main>
    </div>
  )
}
