"use client"

import {
  db,
  getLastSyncedAt,
  setLastSyncedAt,
  type EntityName,
  type SyncQueueItem,
} from "@/db"
import { replaceSynced } from "@/lib/db/repo"
import { ApiError, apiFetch } from "@/lib/api/client"
import type {
  Holiday,
  LessonPlan,
  Period,
  Subject,
  TeachingClass,
} from "@/lib/api/types"

// The wire half of offline-first: drain the local queue upward, then pull
// everything changed since the last successful pull.

const PULL_LIMIT = 500

function pullPath(entity: EntityName, since: string | null): string {
  const params = new URLSearchParams({
    include_deleted: "true",
    limit: String(PULL_LIMIT),
  })
  if (since) params.set("updated_since", since)
  return `/${entity.replace("_", "-")}?${params}`
}

async function pullOne<T>(
  entity: EntityName,
  since: string | null
): Promise<T[]> {
  return apiFetch<T[]>(pullPath(entity, since))
}

// ── PULL ───────────────────────────────────────────────────

export async function pull(): Promise<void> {
  const since = await getLastSyncedAt()
  // Cursor is taken before the request: rows written while it is in flight get
  // picked up next round instead of being skipped.
  const cursor = new Date().toISOString()

  const [classes, subjects, periods, plans, holidays] = await Promise.all([
    pullOne<TeachingClass>("classes", since),
    pullOne<Subject>("subjects", since),
    pullOne<Period>("periods", since),
    pullOne<LessonPlan>("lesson_plans", since),
    pullOne<Holiday>("holidays", since),
  ])

  await db.transaction(
    "rw",
    [db.classes, db.subjects, db.periods, db.lesson_plans, db.holidays],
    async () => {
      await replaceSynced(db.classes, classes)
      await replaceSynced(db.subjects, subjects)
      await replaceSynced(db.periods, periods)
      await replaceSynced(db.lesson_plans, plans)
      await replaceSynced(db.holidays, holidays)
    }
  )

  await setLastSyncedAt(cursor)
}

// ── PUSH ───────────────────────────────────────────────────

async function pushOne(item: SyncQueueItem): Promise<void> {
  const path = `/${item.entity.replace("_", "-")}`
  if (item.op === "delete") {
    await apiFetch<void>(`${path}/${item.entity_id}`, { method: "DELETE" })
    return
  }
  if (item.op === "update") {
    await apiFetch(`${path}/${item.entity_id}`, {
      method: "PATCH",
      body: item.payload,
    })
    return
  }
  await apiFetch(path, { method: "POST", body: item.payload })
}

/** Drains the queue in order. Returns how many items made it. */
export async function push(): Promise<number> {
  const items = await db.sync_queue.orderBy("id").toArray()
  let pushed = 0

  for (const item of items) {
    try {
      await pushOne(item)
      await db.sync_queue.delete(item.id!)
      pushed += 1
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Another device edited this row. Park the local version as a conflict
        // and stop retrying it; the user resolves it in the UI.
        await markConflict(item.entity, item.entity_id)
        await db.sync_queue.delete(item.id!)
        continue
      }
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        // The server will never accept this payload; retrying only blocks the
        // queue. Drop it and let the next pull restore server truth.
        await db.sync_queue.delete(item.id!)
        continue
      }
      // Network or 5xx: keep the queue intact and try again later.
      throw error
    }
  }

  return pushed
}

async function markConflict(entity: EntityName, id: string): Promise<void> {
  switch (entity) {
    case "classes":
      await db.classes.update(id, { sync_status: "conflict" })
      return
    case "subjects":
      await db.subjects.update(id, { sync_status: "conflict" })
      return
    case "periods":
      await db.periods.update(id, { sync_status: "conflict" })
      return
    case "lesson_plans":
      await db.lesson_plans.update(id, { sync_status: "conflict" })
      return
    case "holidays":
      await db.holidays.update(id, { sync_status: "conflict" })
      return
  }
}

// ── DRIVER ─────────────────────────────────────────────────

export async function sync(): Promise<{ pushed: number }> {
  const pushed = await push()
  await pull()
  return { pushed }
}

export async function pendingCount(): Promise<number> {
  return db.sync_queue.count()
}
