"use client"

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{ 
          padding: '20px', 
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ 
            textAlign: 'center', 
            maxWidth: '400px',
            padding: '20px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px'
          }}>
            <h1 style={{ marginBottom: '16px', color: '#dc2626' }}>Application Error</h1>
            <p style={{ marginBottom: '20px', color: '#e5e5e5' }}>
              A critical error occurred. Please refresh your browser or restart the app.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={reset}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  backgroundColor: '#4b5563',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}