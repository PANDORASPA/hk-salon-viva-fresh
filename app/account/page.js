import Link from 'next/link'
import { getServerClient } from '../../lib/supabase/server'
import CustomerDashboard from './CustomerDashboard'
import SignOutButton from './SignOutButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: '我的帳戶 | SALON POKE BY VIVA' }

export default async function AccountPage() {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()

  // Fetch WhatsApp from site content
  let whatsapp = '852XXXXXXXX'
  try {
    const { data: sc } = await db.from('site_content').select('content').eq('key', 'public').maybeSingle()
    if (sc?.content?.contact?.whatsapp) whatsapp = sc.content.contact.whatsapp
  } catch (_) {}

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
        <CustomerDashboard whatsapp={whatsapp} />
        {user && (
          <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--cream)', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '0 0 10px' }}>
              已登入：{user.email}
            </p>
            <SignOutButton />
          </div>
        )}
      </main>
    </div>
  )
}
