"use client"

import { CalendarDays, CalendarRange, Settings } from "lucide-react"
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
      <header className="flex h-12 items-center justify-between px-4">
        <span className="font-heading text-sm font-medium">طرحینو</span>
        <div className="flex items-center gap-1">
          <SyncBadge />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 px-4 pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}

function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs",
                  active ? "text-primary" : "text-muted-foreground"
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
