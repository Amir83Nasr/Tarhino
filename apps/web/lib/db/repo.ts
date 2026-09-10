"use client"

import type { Table } from "dexie"

import {
  db,
  type EntityName,
  type Local,
  type QueueOp,
  type SyncQueueItem,
} from "@/db"
import type { SyncStatus } from "@/lib/api/types"

// Local-first data access. Reads come from Dexie, writes land in Dexie and the
// sync queue in the same transaction, so the UI never waits on a request. This
// module knows nothing about HTTP — lib/sync.ts owns the wire.

export type Row = { id: string; updated_at: string; deleted_at: string | null }

// Table<T, string>, not EntityTable: EntityTable resolves the key through
// IDType<Local<T>, "id">, which a generic T cannot satisfy.
export type LocalTable<T extends Row> = Table<Local<T>, string>

const now = () => new Date().toISOString()

/** Server fields only; sync bookkeeping must not go back over the wire. */
function wire(row: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => key !== "sync_status" && key !== "base_updated_at"
    )
  )
}

async function enqueue(
  entity: EntityName,
  entity_id: string,
  op: QueueOp,
  payload: Record<string, unknown>
): Promise<void> {
  const item: SyncQueueItem = {
    entity,
    entity_id,
    op,
    payload,
    created_at: now(),
  }
  await db.sync_queue.add(item)
}

// ── READS ──────────────────────────────────────────────────

/** Live rows only: tombstones exist solely so the deletion can be pushed. */
export async function listLocal<T extends Row>(
  table: LocalTable<T>
): Promise<Local<T>[]> {
  const rows = await table.toArray()
  return rows.filter((row) => !row.deleted_at)
}

export async function getLocal<T extends Row>(
  table: LocalTable<T>,
  id: string
): Promise<Local<T> | undefined> {
  const row = await table.get(id)
  return row?.deleted_at ? undefined : row
}

// ── WRITES ─────────────────────────────────────────────────

export async function createLocal<T extends Row>(
  entity: EntityName,
  table: LocalTable<T>,
  data: Omit<T, "id" | "created_at" | "updated_at" | "deleted_at">
): Promise<Local<T>> {
  const timestamp = now()
  const row = {
    ...data,
    id: crypto.randomUUID(),
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    sync_status: "pending",
    base_updated_at: null,
  } as unknown as Local<T>

  await db.transaction("rw", table, db.sync_queue, async () => {
    await table.add(row)
    await enqueue(entity, row.id, "create", wire(row))
  })
  return row
}

export async function updateLocal<T extends Row>(
  entity: EntityName,
  table: LocalTable<T>,
  id: string,
  patch: Partial<T>
): Promise<void> {
  const timestamp = now()
  await db.transaction("rw", table, db.sync_queue, async () => {
    const current = await table.get(id)
    if (!current || current.deleted_at) return

    const next = {
      ...current,
      ...patch,
      updated_at: timestamp,
      sync_status: "pending" as const,
    }
    await table.put(next)
    // base_updated_at travels with the payload: the server compares it against
    // its own row to spot a concurrent edit from another device.
    await enqueue(entity, id, "update", {
      ...wire(next),
      base_updated_at: current.base_updated_at,
    })
  })
}

export async function deleteLocal<T extends Row>(
  entity: EntityName,
  table: LocalTable<T>,
  id: string
): Promise<void> {
  const timestamp = now()
  await db.transaction("rw", table, db.sync_queue, async () => {
    const current = await table.get(id)
    if (!current || current.deleted_at) return

    await table.put({
      ...current,
      deleted_at: timestamp,
      updated_at: timestamp,
      sync_status: "pending",
    })
    await enqueue(entity, id, "delete", {})
  })
}

// ── CONFLICT RECOVERY ──────────────────────────────────────

/** Re-send the local version, dropping the stale base so the server accepts it. */
export async function requeueLocal<T extends Row>(
  entity: EntityName,
  table: LocalTable<T>,
  id: string
): Promise<void> {
  const row = await table.get(id)
  if (!row) return

  await db.transaction("rw", table, db.sync_queue, async () => {
    await table.put({ ...row, base_updated_at: null, sync_status: "pending" })
    await enqueue(entity, id, "update", { ...wire(row), base_updated_at: null })
  })
}

/**
 * Take the server's version. The local row is dropped and the pull cursor is
 * reset, so the next sync re-fetches it rather than assuming the change was
 * already seen.
 * ponytail: a full re-pull for one row. Add GET-by-id when the dataset is big
 * enough that a full refresh is noticeable.
 */
export async function discardLocal<T extends Row>(
  entity: EntityName,
  table: LocalTable<T>,
  id: string
): Promise<void> {
  await table.delete(id)
  await db.meta.put({ key: "last_synced_at", value: new Date(0).toISOString() })
}

// ── SYNC SUPPORT ───────────────────────────────────────────

/**
 * Store server rows. Pending or conflicted local edits win — a pull must never
 * clobber a change the user has not managed to send yet.
 */
export async function replaceSynced<T extends Row>(
  table: LocalTable<T>,
  rows: T[]
): Promise<void> {
  const dirty = new Set(
    (
      await table.where("sync_status").anyOf("pending", "conflict").toArray()
    ).map((r) => r.id)
  )
  const incoming = rows
    .filter((row) => !dirty.has(row.id))
    .map((row) => ({
      ...row,
      sync_status: "synced" as const,
      base_updated_at: row.updated_at,
    }))

  await table.bulkPut(incoming as unknown as Local<T>[])
}

// ponytail: one switch instead of a table registry — a Record<EntityName, …>
// collapses into an uncallable union of Dexie table types. Add a registry only
// if a sixth entity shows up.
export async function markSyncStatus(
  entity: EntityName,
  id: string,
  status: SyncStatus
): Promise<void> {
  switch (entity) {
    case "classes":
      await db.classes.update(id, { sync_status: status })
      return
    case "subjects":
      await db.subjects.update(id, { sync_status: status })
      return
    case "periods":
      await db.periods.update(id, { sync_status: status })
      return
    case "lesson_plans":
      await db.lesson_plans.update(id, { sync_status: status })
      return
    case "holidays":
      await db.holidays.update(id, { sync_status: status })
      return
  }
}
