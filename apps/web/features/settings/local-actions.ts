"use client"

import { db } from "@/db"
import {
  createLocal,
  deleteLocal,
  requeueLocal,
  discardLocal,
  updateLocal,
} from "@/lib/db/repo"

// Settings edits: local write + queue entry, same as lesson plans. No HTTP here.

// ── CLASSES ────────────────────────────────────────────────

export const addClass = (name: string) =>
  createLocal("classes", db.classes, { name, grade: null, color: null })

export const renameClass = (id: string, name: string) =>
  updateLocal("classes", db.classes, id, { name })

export const removeClass = (id: string) =>
  deleteLocal("classes", db.classes, id)

// ── SUBJECTS ───────────────────────────────────────────────

export const addSubject = (name: string) =>
  createLocal("subjects", db.subjects, { name, color: null })

export const renameSubject = (id: string, name: string) =>
  updateLocal("subjects", db.subjects, id, { name })

export const removeSubject = (id: string) =>
  deleteLocal("subjects", db.subjects, id)

// ── PERIODS ────────────────────────────────────────────────

export async function addPeriod(label: string, start: string, end: string) {
  const order_index = await db.periods.count()
  return createLocal("periods", db.periods, {
    label,
    start_time: start,
    end_time: end,
    order_index,
  })
}

export const savePeriod = (
  id: string,
  patch: {
    label: string
    start_time: string
    end_time: string
    order_index: number
  }
) => updateLocal("periods", db.periods, id, patch)

export const removePeriod = (id: string) =>
  deleteLocal("periods", db.periods, id)

// ── CONFLICT RESOLUTION ────────────────────────────────────

export const keepLocalClass = (id: string) =>
  requeueLocal("classes", db.classes, id)
export const keepLocalSubject = (id: string) =>
  requeueLocal("subjects", db.subjects, id)
export const keepLocalPeriod = (id: string) =>
  requeueLocal("periods", db.periods, id)
export const keepLocalPlan = (id: string) =>
  requeueLocal("lesson_plans", db.lesson_plans, id)

export const discardLocalClass = (id: string) =>
  discardLocal("classes", db.classes, id)
export const discardLocalSubject = (id: string) =>
  discardLocal("subjects", db.subjects, id)
export const discardLocalPeriod = (id: string) =>
  discardLocal("periods", db.periods, id)
export const discardLocalPlan = (id: string) =>
  discardLocal("lesson_plans", db.lesson_plans, id)
