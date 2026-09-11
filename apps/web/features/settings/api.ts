"use client"

import {
  createClass,
  createPeriod,
  createSubject,
  deleteClass,
  deletePeriod,
  deleteSubject,
  renameClass,
  renameSubject,
  savePeriod,
  type PeriodInput,
} from "@/features/teaching/api"

// Settings edits: direct server writes. Callers invalidate the matching list
// query (see settings-sections.tsx) so the UI refreshes from the response.

// ── CLASSES ────────────────────────────────────────────────

export const addClass = (name: string) => createClass(name)

export const renameClassAction = (id: string, name: string) =>
  renameClass(id, name)

export const removeClass = (id: string) => deleteClass(id)

// ── SUBJECTS ───────────────────────────────────────────────

export const addSubject = (name: string) => createSubject(name)

export const renameSubjectAction = (id: string, name: string) =>
  renameSubject(id, name)

export const removeSubject = (id: string) => deleteSubject(id)

// ── PERIODS ────────────────────────────────────────────────

export function addPeriod(
  label: string,
  start: string,
  end: string,
  order_index: number
) {
  const input: PeriodInput = {
    label,
    start_time: start,
    end_time: end,
    order_index,
  }
  return createPeriod(input)
}

export const savePeriodAction = (id: string, patch: PeriodInput) =>
  savePeriod(id, patch)

export const removePeriod = (id: string) => deletePeriod(id)
