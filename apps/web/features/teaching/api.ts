"use client"

import { apiFetch } from "@/lib/api/client"
import type {
  Holiday,
  LessonPlan,
  LessonStatus,
  Period,
  Subject,
  TeachingClass,
} from "@/lib/api/types"

// Online data access. The server is the source of truth; every read below is a
// GET and every write invalidates its list query (see hooks.ts).

// ── LISTS ──────────────────────────────────────────────────

export const listClasses = () => apiFetch<TeachingClass[]>("/classes")

export const listSubjects = () => apiFetch<Subject[]>("/subjects")

export const listPeriods = () => apiFetch<Period[]>("/periods")

export function listLessonPlans(from: string, to: string) {
  const params = new URLSearchParams({ date_from: from, date_to: to })
  return apiFetch<LessonPlan[]>(`/lesson-plans?${params}`)
}

export function listHolidays(from: string, to: string) {
  const params = new URLSearchParams({ date_from: from, date_to: to })
  return apiFetch<Holiday[]>(`/holidays?${params}`)
}

// ── LESSON PLANS ───────────────────────────────────────────

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

export function createLessonPlan(input: LessonPlanInput) {
  return apiFetch<LessonPlan>("/lesson-plans", {
    method: "POST",
    body: { ...input, notes: input.notes ?? "" },
  })
}

export function updateLessonPlan(id: string, input: LessonPlanInput) {
  return apiFetch<LessonPlan>(`/lesson-plans/${id}`, {
    method: "PATCH",
    body: input,
  })
}

export function deleteLessonPlan(id: string) {
  return apiFetch<void>(`/lesson-plans/${id}`, { method: "DELETE" })
}

// ── CLASSES ────────────────────────────────────────────────

export function createClass(name: string) {
  return apiFetch<TeachingClass>("/classes", {
    method: "POST",
    body: { name },
  })
}

export function renameClass(id: string, name: string) {
  return apiFetch<TeachingClass>(`/classes/${id}`, {
    method: "PATCH",
    body: { name },
  })
}

export function deleteClass(id: string) {
  return apiFetch<void>(`/classes/${id}`, { method: "DELETE" })
}

// ── SUBJECTS ───────────────────────────────────────────────

export function createSubject(name: string) {
  return apiFetch<Subject>("/subjects", {
    method: "POST",
    body: { name },
  })
}

export function renameSubject(id: string, name: string) {
  return apiFetch<Subject>(`/subjects/${id}`, {
    method: "PATCH",
    body: { name },
  })
}

export function deleteSubject(id: string) {
  return apiFetch<void>(`/subjects/${id}`, { method: "DELETE" })
}

// ── PERIODS ────────────────────────────────────────────────

export type PeriodInput = {
  label: string
  start_time: string
  end_time: string
  order_index: number
}

export function createPeriod(input: PeriodInput) {
  return apiFetch<Period>("/periods", { method: "POST", body: input })
}

export function savePeriod(id: string, input: PeriodInput) {
  return apiFetch<Period>(`/periods/${id}`, {
    method: "PATCH",
    body: input,
  })
}

export function deletePeriod(id: string) {
  return apiFetch<void>(`/periods/${id}`, { method: "DELETE" })
}
