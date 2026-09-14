'use client'

import Link from 'next/link'

// Per-route error boundary. Replaces the broken subtree with a
// minimal branded message. The global error boundary catches anything
// that escapes this.
export default function RouteError({ error, reset }) {
  return (
    <div className="present-74b16870">
      <div className="present-7e8614f4">
        <p className="present-f1fde8e1">
          500
        </p>
        <h1 className="present-3e864c57">
          呢一頁暫時載唔到
        </h1>
        <p className="present-c77315de">
          請稍後再試。如果問題持續，請 <Link href="/contact" className="present-154eba31">聯絡我哋</Link>。
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="present-66363ce8"
        >
          重試
        </button>
      </div>
    </div>
  )
}
