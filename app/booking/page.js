import Link from 'next/link'
import { getServerClient } from '../../lib/supabase/server'
import BookingForm from './BookingForm'
import { defaultServices } from '../../content/salon-poke-defaults'

export const metadata = { title: '預約 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

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
            <Link href="/">SALON POKE</Link>
            <Link href="/services">服務</Link>
            <Link href="/booking">預約</Link>
            <Link href="/gallery">圖庫</Link>
            <Link href="/about">關於</Link>
            <Link href="/contact">聯絡</Link>
          </nav>
        </div>
      </header>
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ marginBottom: 8, textAlign: 'left' }}>預約服務</h1>
        <p style={{ color: '#706961', marginBottom: 40 }}>填寫以下資料，我們會盡快確認你的預約。</p>
        <BookingForm services={svcList} />
      </main>
    </div>
  )
}
