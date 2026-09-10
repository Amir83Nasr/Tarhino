"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useEffect, useRef, useState } from "react"

import { db } from "@/db"
import { useOnline } from "@/hooks/use-online"
import { sync } from "@/lib/sync"

// Drives the sync loop: on mount, whenever the browser comes back online, and on
// a slow interval as a safety net. Failures are silent — the queue persists and
// the next tick retries.

const INTERVAL_MS = 60_000

export function useSync() {
  const online = useOnline()
  const [syncing, setSyncing] = useState(false)
  const running = useRef(false)

  const pending = useLiveQuery(() => db.sync_queue.count(), [], 0)
  const conflicts = useLiveQuery(
    () => db.lesson_plans.where("sync_status").equals("conflict").count(),
    [],
    0
  )

  useEffect(() => {
    if (!online) return

    let cancelled = false

    async function run() {
      if (running.current) return
      running.current = true
      setSyncing(true)
      try {
        await sync()
      } catch {
        // Offline again mid-flight, or the server is down. Retry next tick.
      } finally {
        running.current = false
        if (!cancelled) setSyncing(false)
      }
    }

    void run()
    const timer = setInterval(run, INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [online])

  return { syncing, pending: pending ?? 0, conflicts: conflicts ?? 0, online }
}
