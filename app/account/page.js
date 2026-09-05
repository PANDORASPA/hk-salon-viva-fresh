import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerClient } from '../../lib/supabase/server'
import SignOutButton from './SignOutButton'
import './account.css'

export const metadata = { title: '我的帳戶 | SALON POKE BY VIVA' }

export default async function AccountPage() {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/signin?redirectTo=/account')

  const [{ data: profile }, { data: appointments }] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    db.from('appointments').select('*, services(name, duration_minutes)').eq('user_id', user.id).order('starts_at', { ascending: false }),
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
        <h1 style={{ font: '600 36px/1.1 Georgia,serif', marginBottom: 8 }}>我的帳戶</h1>
        <p style={{ color: '#706961', marginBottom: 32 }}>已登入：{profile?.full_name || user.email}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
          <Link className="salon-button" href="/booking">立即預約</Link>
          <SignOutButton />
        </div>
        <h2 style={{ font: '600 24px/1.1 Georgia,serif', marginBottom: 20 }}>我的預約</h2>
        {appointments?.length ? (
          <div className="admin-list">
            {appointments.map(row => (
              <article key={row.id}>
                <div>
                  <strong>{row.services?.name || '服務'}</strong>
                  <p>{new Date(row.starts_at).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'long', timeStyle: 'short' })}</p>
                </div>
                <span className={`status ${row.status}`}>{row.status}</span>
              </article>
            ))}
          </div>
        ) : (
          <p style={{ color: '#928a81' }}>暫時沒有預約記錄。</p>
        )}
        <div style={{ marginTop: 40, padding: 24, background: '#f7f3ec', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>聯絡我們</h3>
          <p style={{ color: '#706961', marginBottom: 16 }}>如有任何關於套票或預約的問題，歡迎聯絡我們。</p>
          <a className="salon-button" href="https://wa.me/852XXXXXXXX" target="_blank" rel="noopener">WhatsApp 查詢</a>
        </div>
      </main>
    </div>
  )
}
