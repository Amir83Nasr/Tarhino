"use client"

import { CalendarDays, CalendarRange, Settings } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { SyncBadge } from "@/components/sync-badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { useCurrentUser } from "@/hooks/use-current-user"

const NAV = [
  { href: "/today", label: "امروز", icon: CalendarDays },
  { href: "/week", label: "هفته", icon: CalendarRange },
  { href: "/settings", label: "تنظیمات", icon: Settings },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useCurrentUser()
  const router = useRouter()
  const pathname = usePathname()
  const pageTitle =
    NAV.find(({ href }) => pathname.startsWith(href))?.label ?? "Tarhino"

  useEffect(() => {
    if (status === "anonymous") router.replace("/login")
  }, [status, router])

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        در حال بارگذاری…
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 px-4 backdrop-blur-xl supports-backdrop-filter:bg-background/55">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3">
          <Link
            href="/today"
            className="flex shrink-0 items-center gap-2 rounded-md md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:outline-none"
          >
            <Image src="/logo.svg" alt="" width={26} height={26} priority />
            <span className="hidden font-heading text-base font-semibold md:inline">
              طرحینو
            </span>
          </Link>
          <span className="font-heading text-sm font-medium md:hidden">
            {pageTitle}
          </span>
          <nav
            className="absolute inset-x-0 hidden items-center justify-center md:flex"
            aria-label="ناوبری اصلی"
          >
            <HeaderNav />
          </nav>
          <div className="flex shrink-0 items-center gap-1.5">
            <SyncBadge />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 pb-24 md:pb-8">{children}</main>
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
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
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <ul className="mx-auto flex max-w-md rounded-full border bg-background/80 p-1 shadow-lg backdrop-blur-md">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-full py-1.5 text-xs transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
