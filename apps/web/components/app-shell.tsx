"use client"

import {
  CalendarRange,
  Mail,
  Phone,
  Send,
  Settings,
  Sparkles,
  User,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { ThemeToggle } from "@/components/theme-toggle"
import { useCurrentUser } from "@/hooks/use-current-user"

const NAV = [
  { href: "/week", label: "برنامه", icon: CalendarRange },
  { href: "/assistant", label: "دستیار", icon: Sparkles },
  { href: "/settings", label: "تنظیمات", icon: Settings },
  { href: "/profile", label: "پروفایل", icon: User },
] as const

// ── TAB NAV (TEST) ──────────────────────────────────────────────
// Slide on navbar tab change only; no finger-drag navigation.
function tabIndexOf(pathname: string) {
  return NAV.findIndex(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`)
  )
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useCurrentUser()
  const router = useRouter()
  const pathname = usePathname()
  const tabIndex = tabIndexOf(pathname)
  const [enterDir, setEnterDir] = useState<-1 | 0 | 1>(0)
  const prevTabRef = useRef(tabIndex)

  useEffect(() => {
    if (status === "anonymous") router.replace("/login")
  }, [status, router])

  // Prefetch tab neighbors so the target opens instantly.
  useEffect(() => {
    const i = NAV.findIndex(
      ({ href }) => pathname === href || pathname.startsWith(`${href}/`)
    )
    if (i < 0) return
    for (const j of [i - 1, i + 1]) {
      const href = NAV[j]?.href
      if (href) router.prefetch(href)
    }
  }, [pathname, router])

  // Page-enter slide after a navbar tab change. Direction follows the
  // tab's visual side: higher index sits left in RTL, so moving there
  // slides in from the left (and vice versa).
  useEffect(() => {
    const prev = prevTabRef.current
    prevTabRef.current = tabIndex
    if (tabIndex < 0 || prev < 0 || tabIndex === prev) return
    if (reducedMotion()) return
    setEnterDir(tabIndex > prev ? -1 : 1)
    const t = window.setTimeout(() => setEnterDir(0), 420)
    return () => window.clearTimeout(t)
  }, [tabIndex])

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 px-4 backdrop-blur-xl supports-backdrop-filter:bg-background/55 print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3">
          <Link
            href="/week"
            className="flex shrink-0 items-center gap-2 rounded-md md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:outline-none"
          >
            <Image
              src="/square.svg"
              alt="طرحینو"
              width={32}
              height={32}
              priority
            />
            <span className="text-base font-bold">طرحینو</span>
          </Link>
          <nav
            className="absolute inset-x-0 hidden items-center justify-center md:flex"
            aria-label="ناوبری اصلی"
          >
            <HeaderNav />
          </nav>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-x-clip px-4 pt-4 pb-4 md:pb-8">
        {/* Header and nav are static, so only the page body waits on the session. */}
        {status === "authenticated" ? (
          <div
            key={tabIndex}
            className={cn(
              enterDir === 1 && "tab-enter-right",
              enterDir === -1 && "tab-enter-left"
            )}
          >
            {children}
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
      </main>
      <Footer />
      <div className="sticky bottom-0 z-40 pt-2 md:hidden print:hidden">
        <BottomNav />
      </div>
    </div>
  )
}

function Footer() {
  const year = new Date().toLocaleDateString("fa-IR", { year: "numeric" })

  return (
    <footer className="hidden border-t bg-background md:block print:hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-x-6 gap-y-4 px-4 py-5 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">ارتباط با ما</p>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Send className="size-4 shrink-0" />
              <span>بله:</span>
              <a
                href="https://ble.ir/Amir83Nasr"
                target="_blank"
                rel="noreferrer"
                dir="ltr"
                className="text-foreground underline underline-offset-4"
              >
                Amir83Nasr
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" />
              <span>تلفن:</span>
              <a href="tel:+989306853363" className="text-foreground">
                ۰۹۳۰۶۸۵۳۳۶۳
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" />
              <span>ایمیل:</span>
              <a
                href="mailto:amirhossein.nasrollahi.main@gmail.com"
                dir="ltr"
                className="text-foreground underline underline-offset-4"
              >
                amirhossein.nasrollahi.main@gmail.com
              </a>
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">انتقادها و پیشنهادها</p>
          <p className="text-sm text-muted-foreground">
            نظر شما طرحینو را بهتر می‌کند. در صفحه جدا توضیح داده‌ایم چه بنویسید
            و از چه راهی بفرستید.
          </p>
          <Link
            href="/feedback"
            className="w-fit rounded-md text-sm text-primary underline underline-offset-4"
          >
            ثبت انتقاد یا پیشنهاد
          </Link>
        </div>
        <p className="text-xs text-muted-foreground md:self-end md:justify-self-end">
          © {year} طرحینو
        </p>
      </div>
    </footer>
  )
}

function HeaderNav() {
  const pathname = usePathname()

  return (
    <ul className="flex items-center gap-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="px-4 pb-[calc(env(safe-area-inset-bottom,0)+0.75rem)] [background:linear-gradient(to_top,var(--background)_60%,transparent)]">
      <ul className="mx-auto flex max-w-md rounded-full border bg-background/80 p-1 shadow-lg backdrop-blur-md">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-full py-1.5 text-xs transition-colors active:scale-95",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon
                  key={active ? `on-${href}` : `off-${href}`}
                  className={cn("size-5", active && "tab-pop")}
                />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
