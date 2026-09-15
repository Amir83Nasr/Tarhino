import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { ThemeToggle } from "@/components/theme-toggle"

// ── SITE HEADER ───────────────────────────────────────────────────
// Shared top header for the landing page and the app panel, styled
// after the landing header: fixed-height bar, max-w-7xl container,
// logo + centered nav + theme toggle + actions.
export function SiteHeader({
  homeHref,
  center,
  actions,
  fixed = false,
  hideOnPrint = false,
}: {
  homeHref: string
  center?: ReactNode
  actions?: ReactNode
  fixed?: boolean
  hideOnPrint?: boolean
}) {
  return (
    <header
      className={cn(
        "inset-x-0 top-0 z-40 border-b bg-background/80 backdrop-blur-xl",
        fixed ? "fixed" : "sticky",
        hideOnPrint && "print:hidden"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        <Link
          href={homeHref}
          className="flex items-center gap-2 text-lg font-bold"
        >
          <span className="flex size-9 items-center justify-center overflow-hidden rounded-lg">
            <Image
              src="/icons/square.svg"
              alt="طرحینو"
              width={36}
              height={36}
              className="size-9"
            />
          </span>
          <span>طرحینو</span>
        </Link>
        {center}
        <span className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          {actions}
        </span>
      </div>
    </header>
  )
}
