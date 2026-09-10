"use client"

import { CloudOff, RefreshCw } from "lucide-react"

import { useSync } from "@/hooks/use-sync"

/** Small, quiet indicator: only speaks up when something is not synced. */
export function SyncBadge() {
  const { syncing, pending, online } = useSync()

  if (!online) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CloudOff className="size-3.5" />
        آفلاین
      </span>
    )
  }

  if (syncing || pending > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <RefreshCw className="size-3.5 animate-spin" />
        {pending > 0 ? `${pending} در انتظار` : "همگام‌سازی"}
      </span>
    )
  }

  return null
}
