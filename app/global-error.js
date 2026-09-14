'use client'

import './globals.css'
import './presentation.css'

// Global error boundary. Renders inside <body> so the layout is
// reloaded fresh and we can show a clean error screen even when the
// root layout itself throws.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="present-073c1bfc">
        <main className="present-9a0143e8">
          <p className="present-f1fde8e1">
            Error
          </p>
          <h1 className="present-3c28d7bd">
            Something went wrong
          </h1>
          <p className="present-8433b878">
            The site hit an unexpected error. The team has been notified.
          </p>
          {error?.message && (
            <p className="present-43d1b9f6">
              {error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            className="present-71142514"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
