"use client"

import { CloudOff, RefreshCw } from "lucide-react"

import { useSync } from "@/hooks/use-sync"

/**
 * Floating corner indicator: only speaks up when something is not synced.
 * Sits above the bottom nav on mobile, bottom-start corner on desktop.
 */
export function SyncBadge() {
  const { syncing, pending, online } = useSync()

  if (!online) {
    return (
      <Badge>
        <CloudOff className="size-3.5" />
        آفلاین
      </Badge>
    )
  }

  if (syncing || pending > 0) {
    return (
      <Badge>
        <RefreshCw className="size-3.5 animate-spin" />
        {pending > 0 ? `${pending} در انتظار` : "همگام‌سازی"}
      </Badge>
    )
  }

  return null
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed start-4 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-40 flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-lg backdrop-blur-md md:start-6 md:bottom-4"
    >
      {children}
    </div>
  )
}
