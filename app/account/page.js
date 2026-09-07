import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerClient } from '../../lib/supabase/server'
import SignOutButton from './SignOutButton'
import BookingsClient from './BookingsClient'

export const metadata = { title: '我的帳戶 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/signin?redirectTo=/account')

  const [{ data: profile }, { data: appointments }, { data: customerPackages }] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    db.from('appointments')
      .select('id, starts_at, status, customer_package_id, services(name, duration_minutes)')
      .eq('user_id', user.id)
      .order('starts_at', { ascending: false })
      .limit(50),
    db.from('customer_packages')
      .select('id, sessions_remaining, total_sessions, is_active, expires_at, packages(name, colour_hex)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

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
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 36 }}>
          我的帳戶
        </h1>
        <p style={{ color: '#706961', marginBottom: 32 }}>已登入：{profile?.full_name || user.email}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
          <Link className="salon-button" href="/booking">立即預約</Link>
          <SignOutButton />
        </div>

        <h2 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 20, fontSize: 24 }}>
          我的套票
        </h2>
        {customerPackages?.length ? (
          <div className="admin-list" style={{ marginBottom: 40 }}>
            {customerPackages.map(cp => (
              <article key={cp.id}>
                <div>
                  <strong>{cp.packages?.name || '套票'}</strong>
                  <p>
                    剩餘 {cp.sessions_remaining}/{cp.total_sessions} 次
                    {cp.expires_at && ` · 到期 ${new Date(cp.expires_at).toLocaleDateString('zh-HK')}`}
                  </p>
                </div>
                <span
                  className="status"
                  style={{
                    background: cp.sessions_remaining === 0 ? '#fee2e2' :
                                 cp.is_active && new Date(cp.expires_at) > new Date() ? '#d1fae5' : '#f3f4f6',
                    color:      cp.sessions_remaining === 0 ? '#991b1b' :
                                 cp.is_active && new Date(cp.expires_at) > new Date() ? '#065f46' : '#374151',
                  }}
                >
                  {cp.sessions_remaining === 0 ? '已用完' :
                   !cp.is_active ? '已停用' :
                   new Date(cp.expires_at) <= new Date() ? '已過期' : '有效'}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p style={{ color: '#928a81', marginBottom: 40 }}>暫時沒有套票。如有需要，請聯絡我們或到前台購買。</p>
        )}

        <h2 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 20, fontSize: 24 }}>
          我的預約
        </h2>
        <BookingsClient initialBookings={appointments || []} />

        <div style={{ marginTop: 40, padding: 24, background: '#f7f3ec', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>聯絡我們</h3>
          <p style={{ color: '#706961', marginBottom: 16 }}>如有任何關於套票或預約的問題，歡迎聯絡我們。</p>
          <a className="salon-button" href="https://wa.me/852XXXXXXXX" target="_blank" rel="noopener">WhatsApp 查詢</a>
        </div>
      </main>
    </div>
  )
}
