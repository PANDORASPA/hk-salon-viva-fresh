'use client'

import Link from 'next/link'

// Per-route error boundary. Replaces the broken subtree with a
// minimal branded message. The global error boundary catches anything
// that escapes this.
export default function RouteError({ error, reset }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <p style={{ color: '#a98152', letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 12, marginBottom: 12 }}>
          500
        </p>
        <h1 style={{ fontFamily: 'Cormorant Garamond,Georgia,serif', fontSize: 28, fontWeight: 600, margin: '0 0 12px', color: '#2c2826' }}>
          呢一頁暫時載唔到
        </h1>
        <p style={{ color: '#706961', marginBottom: 24 }}>
          請稍後再試。如果問題持續，請 <Link href="/contact" style={{ color: '#a98152' }}>聯絡我哋</Link>。
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: '10px 20px', background: '#a98152', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          重試
        </button>
      </div>
    </div>
  )
}
