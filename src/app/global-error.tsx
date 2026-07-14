'use client'

// Last-resort error boundary: replaces the root layout, so it must render its
// own <html> and <body> and cannot rely on global styles.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#fff',
          color: '#111',
        }}
      >
        <main role="alert" style={{ textAlign: 'center', padding: '1rem', maxWidth: '24rem' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Atlas hit a problem</h1>
          <p style={{ fontSize: '0.875rem', color: '#555', marginBottom: '1.5rem' }}>
            Something went wrong loading the app{error.digest ? ` (reference ${error.digest})` : ''}.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: '#111',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  )
}
