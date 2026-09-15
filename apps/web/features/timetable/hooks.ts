"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  appendPlansToCache,
  removePlansFromCache,
  useClassSubjects,
  useSubjects,
} from "@/features/teaching/hooks"
import type { EnsureWeekResult, Subject, WeeklySlot } from "@/lib/api/types"

import {
  createWeeklySlot,
  deleteWeeklySlot,
  ensureWeek,
  listWeeklySlotsByClass,
  updateWeeklySlot,
  type WeeklySlotInput,
} from "@/features/timetable/api"

// ── READS ──────────────────────────────────────────────────
// Keyed per class: the grid shows one class at a time.

const SLOT_CACHE = {
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
} as const

export function useWeeklySlots(classId: string | null) {
  return useQuery({
    queryKey: ["weekly-slots", classId],
    queryFn: () => listWeeklySlotsByClass(classId as string),
    enabled: !!classId,
    ...SLOT_CACHE,
  })
}

/** Subject catalog rows linked to this class (what a cell can pick). */
export function useTimetableSubjects(classId: string | null) {
  const links = useClassSubjects(classId)
  const subjects = useSubjects()
  if (!links || !subjects) return undefined
  const byId = new Map(subjects.map((s) => [s.id, s]))
  return links
    .map((l) => byId.get(l.subject_id))
    .filter((s): s is Subject => !!s)
}

/** Bells of the picked class. Re-exported so the page imports one module. */
export { usePeriodsByClass } from "@/features/teaching/hooks"

// ── WRITES ─────────────────────────────────────────────────
// One cell = one slot row (unique per weekday+period). Optimistic patch,
// server confirms, then a light refetch reconciles (cheap: one class).

export type SlotCell = {
  weekday: number
  period_id: string
  slot: WeeklySlot | null
}

export function slotFor(
  slots: WeeklySlot[] | undefined,
  weekday: number,
  periodId: string
): WeeklySlot | null {
  return (
    slots?.find((s) => s.weekday === weekday && s.period_id === periodId) ??
    null
  )
}

export function useSaveSlotCell(classId: string) {
  const client = useQueryClient()
  const key = ["weekly-slots", classId]
  return useMutation({
    mutationFn: (args: {
      cell: SlotCell
      subject_id: string | null
    }): Promise<WeeklySlot | null> => {
      const { cell, subject_id } = args
      if (subject_id === null) {
        if (!cell.slot) return Promise.resolve(null)
        return deleteWeeklySlot(cell.slot.id).then(() => null)
      }
      if (cell.slot) {
        if (cell.slot.subject_id === subject_id) {
          return Promise.resolve(cell.slot)
        }
        return updateWeeklySlot(cell.slot.id, { subject_id })
      }
      const input: WeeklySlotInput = {
        weekday: cell.weekday,
        class_id: classId,
        subject_id,
        period_id: cell.period_id,
      }
      return createWeeklySlot(input)
    },
    onMutate: async ({ cell, subject_id }) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<WeeklySlot[]>(key)
      if (subject_id === null) {
        // Delete: drop the row now, server confirms.
        client.setQueryData<WeeklySlot[]>(key, (old) =>
          (old ?? []).filter(
            (s) =>
              !(s.weekday === cell.weekday && s.period_id === cell.period_id)
          )
        )
      } else if (cell.slot) {
        // Retarget: patch subject optimistically.
        client.setQueryData<WeeklySlot[]>(key, (old) =>
          (old ?? []).map((s) =>
            s.id === cell.slot!.id ? { ...s, subject_id } : s
          )
        )
      }
      // Create: no temp row — the cell shows a spinner until confirm.
      return { previous }
    },
    onError: (_e, _v, context) => {
      if (context) client.setQueryData(key, context.previous)
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: key })
    },
  })
}

/** Auto-fill the visible week, then refresh the /week view. */
export function useEnsureWeek() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      classId,
      weekStart,
    }: {
      classId: string
      weekStart: string
    }) => ensureWeek(classId, weekStart),
    onSuccess: (result: EnsureWeekResult) => {
      const pruned = result.errors
        .map((e) => /^pruned:(.+)$/.exec(e.detail)?.[1])
        .filter((id): id is string => !!id)
      if (pruned.length) removePlansFromCache(client, pruned)
      // Created rows land in the cache now; the refetch below only reconciles.
      appendPlansToCache(client, result.created)
      void client.invalidateQueries({ queryKey: ["lesson-plans"] })
    },
  })
}
