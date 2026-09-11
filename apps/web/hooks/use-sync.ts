"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useCallback, useEffect, useRef, useState } from "react"

import { db } from "@/db"
import { useOnline } from "@/hooks/use-online"
import { sync } from "@/lib/sync"

// Drives the sync loop: on app start, whenever the browser comes back online, and
// shortly after a write lands in the queue. No timer — an idle app makes no
// requests. Failures are silent; the queue persists and the next trigger retries.

const WRITE_DEBOUNCE_MS = 2_000

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

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    setSyncing(true)
    try {
      await sync()
    } catch {
      // Offline again mid-flight, or the server is down. Retry on next trigger.
    } finally {
      running.current = false
      setSyncing(false)
    }
  }, [])

  // App start, and every time the browser comes back online.
  useEffect(() => {
    if (online) void run()
  }, [online, run])

  // On write: the queue grew. Each further write resets the timer, so a burst of
  // edits costs one round trip instead of one per keystroke.
  useEffect(() => {
    if (!online || !pending) return
    const timer = setTimeout(run, WRITE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [online, pending, run])

  return { syncing, pending: pending ?? 0, conflicts: conflicts ?? 0, online }
}
