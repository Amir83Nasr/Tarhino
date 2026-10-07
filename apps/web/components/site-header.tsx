import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { ThemeToggle } from "@/components/theme-toggle"

// ── SITE HEADER ───────────────────────────────────────────────────
// Top bar for the app panel: fixed-height bar, max-w-7xl container,
// logo + centered nav + theme toggle.
export function SiteHeader({
  homeHref,
  center,
  hideOnPrint = false,
}: {
  homeHref: string
  center?: ReactNode
  hideOnPrint?: boolean
}) {
  return (
    <header
      className={cn(
        "sticky inset-x-0 top-0 z-40 border-b bg-background/80 backdrop-blur-xl",
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
        <ThemeToggle />
      </div>
    </header>
  )
}
