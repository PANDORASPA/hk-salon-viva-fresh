'use client'

// Global error boundary. Renders inside <body> so the layout is
// reloaded fresh and we can show a clean error screen even when the
// root layout itself throws.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', background: '#f7f3ec', color: '#2c2826' }}>
        <main style={{ maxWidth: 600, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          <p style={{ color: '#a98152', letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 12, marginBottom: 12 }}>
            Error
          </p>
          <h1 style={{ fontFamily: 'Cormorant Garamond,Georgia,serif', fontSize: 32, fontWeight: 600, margin: '0 0 16px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#706961', marginBottom: 8 }}>
            The site hit an unexpected error. The team has been notified.
          </p>
          {error?.message && (
            <p style={{ color: '#928a81', fontSize: 12, fontFamily: 'monospace', padding: 12, background: '#fff', border: '1px solid #ded5c8', borderRadius: 8, margin: '16px 0 24px', textAlign: 'left', overflow: 'auto' }}>
              {error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: '12px 24px', background: '#a98152', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
