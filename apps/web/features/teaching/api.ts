"use client"

import { apiFetch } from "@/lib/api/client"
import type {
  Assessment,
  ClassSubject,
  Grade,
  GradeScale,
  Holiday,
  LessonPlan,
  LessonStatus,
  Period,
  School,
  Student,
  Subject,
  TeachingClass,
} from "@/lib/api/types"

// Online data access. The server is the source of truth; every read below is a
// GET and every write invalidates its list query (see hooks.ts).

// ── LISTS ──────────────────────────────────────────────────

export const listClasses = () => apiFetch<TeachingClass[]>("/classes")

export const listSubjects = () => apiFetch<Subject[]>("/subjects")

export const listPeriods = () => apiFetch<Period[]>("/periods")

export const listPeriodsByClass = (classId: string) =>
  apiFetch<Period[]>(`/periods/by-class/${classId}`)

export function listLessonPlans(from: string, to: string) {
  const params = new URLSearchParams({ date_from: from, date_to: to })
  return apiFetch<LessonPlan[]>(`/lesson-plans?${params}`)
}

export function listHolidays(from: string, to: string) {
  const params = new URLSearchParams({ date_from: from, date_to: to })
  return apiFetch<Holiday[]>(`/holidays?${params}`)
}

// ── SCHOOLS ────────────────────────────────────────────────

export const listSchools = () => apiFetch<School[]>("/schools")

export function createSchool(name: string) {
  return apiFetch<School>("/schools", { method: "POST", body: { name } })
}

export function renameSchool(id: string, name: string) {
  return apiFetch<School>(`/schools/${id}`, { method: "PATCH", body: { name } })
}

export function deleteSchool(id: string) {
  return apiFetch<void>(`/schools/${id}`, { method: "DELETE" })
}

// ── STUDENTS ───────────────────────────────────────────────

export const listStudentsByClass = (classId: string) =>
  apiFetch<Student[]>(`/students/by-class/${classId}`)

export type StudentInput = {
  class_id: string
  first_name: string
  last_name: string
}

export function createStudent(input: StudentInput) {
  return apiFetch<Student>("/students", { method: "POST", body: input })
}

export function updateStudent(id: string, input: Partial<StudentInput>) {
  return apiFetch<Student>(`/students/${id}`, { method: "PATCH", body: input })
}

export function deleteStudent(id: string) {
  return apiFetch<void>(`/students/${id}`, { method: "DELETE" })
}

export function bulkCreateStudents(classId: string, names: string[]) {
  return apiFetch<Student[]>("/students/bulk", {
    method: "POST",
    body: {
      class_id: classId,
      items: names.map(parseFullName),
    },
  })
}

/** "Ali Ahmadi" → {first, last}; single word becomes first name. */
export function parseFullName(line: string): {
  first_name: string
  last_name: string
} {
  const parts = line.trim().split(/\s+/)
  const first = parts.shift() ?? ""
  return { first_name: first, last_name: parts.join(" ") || "—" }
}

// ── ASSESSMENTS & GRADES ───────────────────────────────────

export const listAssessmentsBySubject = (subjectId: string) =>
  apiFetch<Assessment[]>(`/assessments/by-subject/${subjectId}`)

export function createAssessment(subjectId: string, title: string) {
  return apiFetch<Assessment>("/assessments", {
    method: "POST",
    body: { subject_id: subjectId, title },
  })
}

export function renameAssessment(id: string, title: string) {
  return apiFetch<Assessment>(`/assessments/${id}`, {
    method: "PATCH",
    body: { title },
  })
}

export function deleteAssessment(id: string) {
  return apiFetch<void>(`/assessments/${id}`, { method: "DELETE" })
}

export type Gradebook = {
  assessments: Assessment[]
  grades: Grade[]
}

export const listGradebook = (subjectId: string) =>
  apiFetch<Gradebook>(`/assessments/${subjectId}/gradebook`)

// Numeric mode sends value; descriptive mode sends one of the subject
// scale's 4 labels. The server enforces which one applies.
export function upsertGrade(
  studentId: string,
  assessmentId: string,
  grade: { value: number } | { level: string }
) {
  return apiFetch<Grade>("/grades/upsert", {
    method: "POST",
    body: { student_id: studentId, assessment_id: assessmentId, ...grade },
  })
}

// ── GRADE SCALES (per-subject descriptive bands) ─────────────

export type GradeScaleInput = {
  excellent_min: number
  good_min: number
  pass_min: number
  excellent_label: string
  good_label: string
  fair_label: string
  needs_label: string
}

export const getGradeScale = (subjectId: string) =>
  apiFetch<GradeScale>(`/grade-scales/by-subject/${subjectId}`)

export function saveGradeScale(
  scaleId: string,
  patch: Partial<GradeScaleInput>
) {
  return apiFetch<GradeScale>(`/grade-scales/${scaleId}`, {
    method: "PATCH",
    body: patch,
  })
}

export function createGradeScale(subjectId: string, input: GradeScaleInput) {
  return apiFetch<GradeScale>("/grade-scales", {
    method: "POST",
    body: { subject_id: subjectId, ...input },
  })
}

export const relabelSubjectGrades = (subjectId: string) =>
  apiFetch<number>(`/grade-scales/by-subject/${subjectId}/relabel`, {
    method: "POST",
  })

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"

/** 0–20, decimals allowed; empty string means "clear" (caller deletes nothing). */
export function parseGradeValue(raw: string): number | null {
  let normalized = raw.trim()
  for (let i = 0; i < 10; i++) {
    normalized = normalized
      .replaceAll(FA_DIGITS[i]!, String(i))
      .replaceAll(AR_DIGITS[i]!, String(i))
  }
  normalized = normalized.replace("٫", ".").replace("٬", "").replace(",", ".")
  if (!normalized) return null
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 && value <= 20 ? value : null
}

// ── LESSON PLANS ───────────────────────────────────────────

export type LessonPlanInput = {
  date: string
  activity: string
  class_id: string
  subject_id: string
  period_id: string
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

export function createClass(name: string, school_id: string) {
  return apiFetch<TeachingClass>("/classes", {
    method: "POST",
    body: { name, school_id },
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

// ── CLASS-SUBJECT LINKS ────────────────────────────────────

export const listClassSubjectsByClass = (classId: string) =>
  apiFetch<ClassSubject[]>(`/class-subjects/by-class/${classId}`)

export const listClassSubjectsBySubject = (subjectId: string) =>
  apiFetch<ClassSubject[]>(`/class-subjects/by-subject/${subjectId}`)

export function linkClassSubject(classId: string, subjectId: string) {
  return apiFetch<ClassSubject>("/class-subjects", {
    method: "POST",
    body: { class_id: classId, subject_id: subjectId },
  })
}

export function unlinkClassSubject(id: string) {
  return apiFetch<void>(`/class-subjects/${id}`, { method: "DELETE" })
}

// ── PERIODS ────────────────────────────────────────────────

export type PeriodInput = {
  class_id: string
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
