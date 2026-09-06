'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem('cookie_consent', 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#1a1a1a', color: '#f5f0e8',
      padding: '16px 24px', zIndex: 9999,
      boxShadow: '0 -2px 12px rgba(0,0,0,0.2)',
      fontSize: 14,
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ flex: 1, minWidth: 200, margin: 0 }}>
          我們使用 cookies 來改善你的網站體驗。繼續瀏覽即表示你同意我們的{' '}
          <Link href="/privacy" style={{ color: '#c9a96e', textDecoration: 'underline' }}>隱私政策</Link>。
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={decline}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1.5px solid #555', background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: 13 }}
          >
            拒絕
          </button>
          <button
            onClick={accept}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#c9a96e', color: '#1a1a1a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            接受全部
          </button>
        </div>
      </div>
    </div>
  )
}
