"use client"
import { useEffect } from "react"

export default function RootError({ error }: { error: Error }) {
  // Minimal client-side error boundary required by Next's app router during dev.
  useEffect(() => {
    // Log the error to the console for debugging during development.
    console.error("App-level error:", error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ padding: 20 }}>
          <h1>Something went wrong</h1>
          <p>{error?.message ?? "An unexpected error occurred."}</p>
        </div>
      </body>
    </html>
  )
}
