"use client"

import { useMutation } from "@tanstack/react-query"
import { useLiveQuery } from "dexie-react-hooks"

import { db } from "@/db"
import { createLocal, deleteLocal, updateLocal } from "@/lib/db/repo"
import type { LessonPlan, LessonStatus } from "@/lib/api/types"

export type LessonPlanInput = {
  date: string
  activity: string
  class_id: string | null
  subject_id: string | null
  period_id: string | null
  start_time: string | null
  end_time: string | null
  status: LessonStatus
  notes?: string
}

// ── READS ──────────────────────────────────────────────────
// Everything reads from Dexie. Sync keeps Dexie current; the UI never blocks on
// a request and works the same offline.

export function useLessonPlans(from: string, to: string) {
  return useLiveQuery(
    () =>
      db.lesson_plans
        .where("date")
        .between(from, to, true, true)
        .filter((plan) => !plan.deleted_at)
        .toArray(),
    [from, to]
  )
}

export function useHolidays(from: string, to: string) {
  return useLiveQuery(
    () =>
      db.holidays
        .where("date")
        .between(from, to, true, true)
        .filter((holiday) => !holiday.deleted_at)
        .toArray(),
    [from, to]
  )
}

export function useClasses() {
  return useLiveQuery(() => db.classes.filter((c) => !c.deleted_at).toArray())
}

export function useSubjects() {
  return useLiveQuery(() => db.subjects.filter((s) => !s.deleted_at).toArray())
}

export function usePeriods() {
  return useLiveQuery(() =>
    db.periods
      .orderBy("order_index")
      .filter((p) => !p.deleted_at)
      .toArray()
  )
}

/** Name lookups shared by the day and week views. */
export function useLookups() {
  const classes = useClasses()
  const subjects = useSubjects()
  const periods = usePeriods()

  return {
    classes: classes ?? [],
    subjects: subjects ?? [],
    periods: periods ?? [],
    className: (id: string | null) => classes?.find((c) => c.id === id)?.name,
    subjectName: (id: string | null) =>
      subjects?.find((s) => s.id === id)?.name,
    periodLabel: (id: string | null) =>
      periods?.find((p) => p.id === id)?.label,
    period: (id: string | null) => periods?.find((p) => p.id === id),
  }
}

// ── WRITES ─────────────────────────────────────────────────
// Local write, then queue. The mutation resolves as soon as Dexie commits — no
// network in the path, so it works identically offline.

export function useSaveLessonPlan(plan: LessonPlan | null, onDone: () => void) {
  return useMutation({
    mutationFn: async (input: LessonPlanInput) => {
      if (plan) {
        await updateLocal("lesson_plans", db.lesson_plans, plan.id, input)
        return
      }
      await createLocal("lesson_plans", db.lesson_plans, {
        ...input,
        notes: input.notes ?? "",
      })
    },
    onSuccess: onDone,
  })
}

export function useDeleteLessonPlan() {
  return useMutation({
    mutationFn: (id: string) =>
      deleteLocal("lesson_plans", db.lesson_plans, id),
  })
}
