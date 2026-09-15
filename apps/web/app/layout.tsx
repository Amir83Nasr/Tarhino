import type { Metadata, Viewport } from "next"
import { Geist_Mono } from "next/font/google"
import localFont from "next/font/local"
import Script from "next/script"

import "@workspace/ui/globals.css"
import { Providers } from "@/app/providers"
import { cn } from "@workspace/ui/lib/utils"
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site"

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

const TITLE_DEFAULT = "طرحینو | طرح درس، کارنامه و دستیار معلم"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE_DEFAULT, template: "%s | طرحینو" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: "/",
    siteName: SITE_NAME,
    title: TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/icons/logo.png",
        width: 1024,
        height: 1025,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
    images: ["/icons/logo.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icons/square.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/square.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
}

// Chrome toolbar: light = primary #be123c, dark = body #060606.
// themeColor is intentionally NOT exported here: a server-rendered
// media-based meta follows the OS preference, so on reload with OS light +
// in-app dark the toolbar flashes red before React hydrates. Instead the
// blocking script below injects the single correct meta before paint,
// following the stored in-app theme (localStorage "theme").
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
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
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        "font-sans",
        fontMono.variable,
        iranYekanX.variable
      )}
    >
      <body>
        {/* Blocking theme-color fix: runs before paint so the Chrome toolbar
            matches the stored in-app theme on reload (no red flash in dark).
            Must stay in sync with ThemeColorSync in theme-provider.tsx. */}
        <Script
          id="theme-color-fix"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme")||"light";if(t==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var c=t==="dark"?"#060606":"#be123c";var m=document.createElement("meta");m.name="theme-color";m.content=c;document.head.appendChild(m)}catch(e){}})();`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
