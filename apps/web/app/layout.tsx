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
  title: "طرحینو",
  description: "برنامه‌ریزی ساده، تدریس بهتر",
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
