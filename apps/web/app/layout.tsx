import type { Viewport } from "next"
import { Geist_Mono } from "next/font/google"
import localFont from "next/font/local"

import "@workspace/ui/globals.css"
import { Providers } from "@/app/providers"
import { cn } from "@workspace/ui/lib/utils"

const iranYekanX = localFont({
  src: [
    {
      path: "./fonts/IRANYekanX-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    { path: "./fonts/IRANYekanX-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Tarhino",
  description: "برنامه‌ریزی ساده، تدریس بهتر",
  applicationName: "Tarhino",
}

// Chrome toolbar takes --primary: light oklch(0.514 0.222 16.935), dark oklch(0.455 0.188 13.697).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#be123c" },
    { media: "(prefers-color-scheme: dark)", color: "#9f1239" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        "font-sans",
        fontMono.variable,
        iranYekanX.variable
      )}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
