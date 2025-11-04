"use client"
import { useEffect } from "react"

export default function RootError({ 
  error, 
  reset 
}: { 
  error: Error & { digest?: string }
  reset: () => void 
}) {
  useEffect(() => {
    // Log the error with more context for debugging
    console.error("App-level error:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString()
    });

    // Send error to monitoring service in production
    if (process.env.NODE_ENV === 'production' && error.digest) {
      // You could send this to your error tracking service
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: error.digest,
          message: error.message,
          userAgent: window.navigator.userAgent,
          timestamp: new Date().toISOString(),
          url: window.location.href
        })
      }).catch(() => {
        // Silently fail if error reporting fails
      });
    }
  }, [error])

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
            <h1 style={{ marginBottom: '16px', color: '#dc2626' }}>Something went wrong</h1>
            <p style={{ marginBottom: '20px', color: '#e5e5e5' }}>
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details style={{ 
                marginBottom: '20px', 
                textAlign: 'left',
                fontSize: '12px',
                color: '#a3a3a3'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
                  Debug Information
                </summary>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  backgroundColor: '#1a1a1a',
                  padding: '8px',
                  borderRadius: '4px'
                }}>
                  {error.message}
                  {error.digest && `\nDigest: ${error.digest}`}
                </pre>
              </details>
            )}
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
          </div>
        </div>
      </body>
    </html>
  )
}
