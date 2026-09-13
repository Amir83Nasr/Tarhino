"use client"

import Image from "next/image"
import { useEffect } from "react"

// Last-resort boundary: replaces the root layout when it crashes, so it
// renders its own <html>/<body> and uses inline styles only — no providers,
// theme, or global CSS to depend on.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100svh",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          fontFamily: "system-ui, Tahoma, sans-serif",
          background: "#fff",
          color: "#111",
        }}
      >
        <div style={{ maxWidth: 28 * 16, textAlign: "center" }}>
          <Image src="/square.svg" alt="طرحینو" width={64} height={64} />
          <p
            style={{
              margin: "20px 0 0",
              fontSize: 72,
              fontWeight: 700,
              color: "#be123c",
            }}
          >
            ۵۰۰
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: 18 }}>مشکلی پیش آمد</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#555" }}>
            برنامه باز نشد. یک بار دیگر تلاش کنید.
          </p>
          <div
            style={{
              marginTop: 20,
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "10px 16px",
                border: "none",
                borderRadius: 8,
                background: "#be123c",
                color: "#fff",
                fontSize: 14,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              تلاش دوباره
            </button>
            <a
              href="/week"
              style={{
                padding: "10px 16px",
                border: "1px solid #ddd",
                borderRadius: 8,
                color: "#111",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              بازگشت به برنامه
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
