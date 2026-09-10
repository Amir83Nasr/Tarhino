import Dexie, { type EntityTable, type Table } from "dexie"

import type {
  Holiday,
  LessonPlan,
  Period,
  Subject,
  SyncStatus,
  TeachingClass,
} from "@/lib/api/types"

// Local mirrors carry sync bookkeeping on top of the server row. Tombstones come
// from the server; a local delete writes one too so it can be pushed later.
// Nothing outside db/ and lib/db/ touches Dexie.

export type Local<T> = T & {
  sync_status: SyncStatus
  /** Server version this local row was derived from; null if never synced. */
  base_updated_at: string | null
}

export type QueueOp = "create" | "update" | "delete"

export type EntityName =
  | "classes"
  | "subjects"
  | "periods"
  | "lesson_plans"
  | "holidays"

export type SyncQueueItem = {
  id?: number
  entity: EntityName
  entity_id: string
  op: QueueOp
  payload: Record<string, unknown>
  created_at: string
}

export class TarhinoDB extends Dexie {
  // Table<_, string>, not EntityTable: ids are minted by the client (crypto
  //.randomUUID), so nothing here uses Dexie's auto-increment `create()`.
  classes!: Table<Local<TeachingClass>, string>
  subjects!: Table<Local<Subject>, string>
  periods!: Table<Local<Period>, string>
  lesson_plans!: Table<Local<LessonPlan>, string>
  holidays!: Table<Local<Holiday>, string>
  sync_queue!: EntityTable<SyncQueueItem, "id">
  meta!: EntityTable<{ key: string; value: string }, "key">

  constructor() {
    super("tarhino")

    this.version(1).stores({
      classes: "id, updated_at, sync_status",
      subjects: "id, updated_at, sync_status",
      periods: "id, order_index, updated_at, sync_status",
      lesson_plans:
        "id, date, period_id, updated_at, sync_status, [date+period_id]",
      holidays: "id, date, updated_at, sync_status",
      sync_queue: "++id, entity, entity_id, created_at",
      meta: "key",
    })
  }
}

// Guarded: Dexie touches indexedDB at construction, which does not exist during
// the server render pass.
export const db =
  typeof window === "undefined"
    ? (null as unknown as TarhinoDB)
    : new TarhinoDB()

/** Timestamp of the last successful pull; the cursor for incremental sync. */
export async function getLastSyncedAt(): Promise<string | null> {
  if (!db) return null
  const row = await db.meta.get("last_synced_at")
  return row?.value ?? null
}

export async function setLastSyncedAt(value: string): Promise<void> {
  if (!db) return
  await db.meta.put({ key: "last_synced_at", value })
}
