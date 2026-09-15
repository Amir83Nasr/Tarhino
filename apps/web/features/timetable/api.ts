"use client"

import { apiFetch } from "@/lib/api/client"
import type { EnsureWeekResult, WeeklySlot } from "@/lib/api/types"

// Fixed weekly template. Server is the source of truth; reads are per class
// (bells belong to a class, so the grid is per class too).

export const listWeeklySlotsByClass = (classId: string) =>
  apiFetch<WeeklySlot[]>(`/weekly-slots/by-class/${classId}`)

export type WeeklySlotInput = {
  weekday: number
  class_id: string
  subject_id: string
  period_id: string
}

export function createWeeklySlot(input: WeeklySlotInput) {
  return apiFetch<WeeklySlot>("/weekly-slots", {
    method: "POST",
    body: input,
  })
}

export function updateWeeklySlot(id: string, input: Partial<WeeklySlotInput>) {
  return apiFetch<WeeklySlot>(`/weekly-slots/${id}`, {
    method: "PATCH",
    body: input,
  })
}

export function deleteWeeklySlot(id: string) {
  return apiFetch<void>(`/weekly-slots/${id}`, { method: "DELETE" })
}

/** Auto-fill one week from the template (create missing, prune stale). */
export function ensureWeek(classId: string, weekStart: string) {
  return apiFetch<EnsureWeekResult>("/lesson-plans/ensure-week", {
    method: "POST",
    body: { class_id: classId, week_start: weekStart },
  })
}
