"use client"

import * as XLSX from "xlsx"

import { db } from "@/db"
import { createLocal } from "@/lib/db/repo"
import {
  fromISODate,
  parseJalali,
  toJalali,
  toLatinDigits,
  toPersianDigits,
} from "@/lib/date/jalali"
import type {
  LessonPlan,
  LessonStatus,
  Period,
  Subject,
  TeachingClass,
} from "@/lib/api/types"

// Excel round-trip for lesson plans. Export writes Jalali dates — the format
// teachers live in — and import reads that same format back. Import is two
// steps: parse() is pure and returns the issues the preview renders; commit()
// writes drafts through the offline repo, so an imported file syncs like any
// other edit.

// ── SHARED ─────────────────────────────────────────────────

const SHEET = "طرح درس"

const STATUS_LABELS: Record<LessonStatus, string> = {
  planned: "برنامه‌ریزی‌شده",
  done: "انجام‌شده",
  cancelled: "لغو‌شده",
}

const LABEL_STATUS = new Map(
  Object.entries(STATUS_LABELS).map(([status, label]) => [
    label,
    status as LessonStatus,
  ])
)

const HEADERS = [
  "تاریخ",
  "کلاس",
  "درس",
  "زنگ",
  "شروع",
  "پایان",
  "فعالیت",
  "وضعیت",
  "یادداشت",
] as const

type Header = (typeof HEADERS)[number]

type Lookups = {
  classes: TeachingClass[]
  subjects: Subject[]
  periods: Period[]
}

type ExportRow = Record<Header, string>

const cell = (value: unknown): string =>
  value === null || value === undefined
    ? ""
    : toLatinDigits(String(value).trim())

/** "8:5" / "۰۸:۰۵" → "08:05"; null when there is no time to read. */
function parseTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{1,2})/.exec(toLatinDigits(value))
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

const timeLabel = (time: string | null) =>
  time ? toPersianDigits(time.slice(0, 5)) : ""

// ── EXPORT ─────────────────────────────────────────────────

function buildRows(plans: LessonPlan[], lookups: Lookups): ExportRow[] {
  const className = new Map(lookups.classes.map((c) => [c.id, c.name]))
  const subjectName = new Map(lookups.subjects.map((s) => [s.id, s.name]))
  const periodName = new Map(lookups.periods.map((p) => [p.id, p.label]))

  return plans
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((plan) => {
      const { year, month, day } = toJalali(fromISODate(plan.date))
      return {
        تاریخ: `${toPersianDigits(year)}/${toPersianDigits(month)}/${toPersianDigits(day)}`,
        کلاس: plan.class_id ? (className.get(plan.class_id) ?? "") : "",
        درس: plan.subject_id ? (subjectName.get(plan.subject_id) ?? "") : "",
        زنگ: plan.period_id ? (periodName.get(plan.period_id) ?? "") : "",
        شروع: timeLabel(plan.start_time),
        پایان: timeLabel(plan.end_time),
        فعالیت: plan.activity,
        وضعیت: STATUS_LABELS[plan.status],
        یادداشت: plan.notes,
      }
    })
}

/** Lesson plans in [from, to] (ISO dates) as an .xlsx download. */
export async function exportLessonPlans(
  from: string,
  to: string
): Promise<number> {
  const [plans, classes, subjects, periods] = await Promise.all([
    db.lesson_plans
      .where("date")
      .between(from, to, true, true)
      .filter((plan) => !plan.deleted_at)
      .toArray(),
    db.classes.filter((c) => !c.deleted_at).toArray(),
    db.subjects.filter((s) => !s.deleted_at).toArray(),
    db.periods.filter((p) => !p.deleted_at).toArray(),
  ])

  const sheet = XLSX.utils.json_to_sheet(
    buildRows(plans, { classes, subjects, periods }),
    {
      header: [...HEADERS],
    }
  )
  // The columns hold Jalali dates and Persian names; RTL makes the file readable
  // in Excel/LibreOffice without the teacher flipping the sheet direction.
  sheet["!cols"] = HEADERS.map(() => ({ wch: 16 }))

  const book = XLSX.utils.book_new()
  book.Workbook = { Views: [{ RTL: true }] }
  XLSX.utils.book_append_sheet(book, sheet, SHEET)
  XLSX.writeFile(book, `tarhino-${from}_${to}.xlsx`)

  return plans.length
}

// ── IMPORT: PARSE ──────────────────────────────────────────

/** A validated row, ready to become a lesson plan. */
export type ImportRow = {
  row: number
  date: string
  class_id: string | null
  subject_id: string | null
  period_id: string | null
  start_time: string | null
  end_time: string | null
  activity: string
  notes: string
  status: LessonStatus
}

export type ImportIssue = {
  row: number
  level: "error" | "warning"
  message: string
}

export type ImportPreview = {
  rows: ImportRow[]
  issues: ImportIssue[]
}

/**
 * Read an exported file back. Rows that fail validation are dropped and
 * reported; the rest come back ready for commit(). Nothing is written here.
 */
export async function parseImport(
  file: File,
  lookups: Lookups
): Promise<ImportPreview> {
  const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), {
    type: "array",
  })
  const first = book.SheetNames[0]
  if (!first)
    return {
      rows: [],
      issues: [{ row: 0, level: "error", message: "فایل خالی است" }],
    }

  const sheet = book.Sheets[first]
  if (!sheet)
    return {
      rows: [],
      issues: [{ row: 0, level: "error", message: "فایل خالی است" }],
    }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  })

  const classId = new Map(lookups.classes.map((c) => [c.name.trim(), c.id]))
  const subjectId = new Map(lookups.subjects.map((s) => [s.name.trim(), s.id]))
  const periodByName = new Map(lookups.periods.map((p) => [p.label.trim(), p]))

  const existing = new Set(
    (await db.lesson_plans.toArray())
      .filter((plan) => !plan.deleted_at)
      .map((plan) => `${plan.date}|${plan.period_id ?? ""}`)
  )

  const rows: ImportRow[] = []
  const issues: ImportIssue[] = []

  raw.forEach((record, index) => {
    // +2: sheet rows are 1-based and row 1 is the header.
    const row = index + 2
    const fail = (message: string) =>
      issues.push({ row, level: "error", message })

    const date = parseJalali(cell(record["تاریخ"]))
    if (!date) {
      fail("تاریخ خوانده نشد (نمونه: ۱۴۰۴/۰۳/۱۵)")
      return
    }

    const activity = cell(record["فعالیت"])
    if (!activity) {
      fail("فعالیت خالی است")
      return
    }

    const className = cell(record["کلاس"])
    const class_id = className ? (classId.get(className) ?? null) : null
    if (className && !class_id) fail(`کلاس «${className}» پیدا نشد`)

    const subjectName = cell(record["درس"])
    const subject_id = subjectName ? (subjectId.get(subjectName) ?? null) : null
    if (subjectName && !subject_id) fail(`درس «${subjectName}» پیدا نشد`)

    const periodLabel = cell(record["زنگ"])
    const period = periodLabel ? (periodByName.get(periodLabel) ?? null) : null
    if (periodLabel && !period) fail(`زنگ «${periodLabel}» پیدا نشد`)

    if (!class_id && !subject_id && !period) {
      // Nothing to hang the plan on, but a bare activity is still a valid note.
      issues.push({
        row,
        level: "warning",
        message: "کلاس، درس و زنگ خالی است",
      })
    }

    const start_time =
      parseTime(cell(record["شروع"])) ?? period?.start_time.slice(0, 5) ?? null
    const end_time =
      parseTime(cell(record["پایان"])) ?? period?.end_time.slice(0, 5) ?? null
    if (start_time && end_time && end_time <= start_time) {
      fail("ساعت پایان بعد از شروع نیست")
      return
    }

    const statusLabel = cell(record["وضعیت"])
    const status = statusLabel ? LABEL_STATUS.get(statusLabel) : "planned"
    if (statusLabel && !status) {
      issues.push({
        row,
        level: "warning",
        message: `وضعیت «${statusLabel}» ناشناخته؛ برنامه‌ریزی‌شده شد`,
      })
    }

    if (existing.has(`${date}|${period?.id ?? ""}`)) {
      issues.push({
        row,
        level: "warning",
        message: "برای این تاریخ و زنگ طرحی وجود دارد",
      })
    }

    rows.push({
      row,
      date,
      class_id,
      subject_id,
      period_id: period?.id ?? null,
      start_time,
      end_time,
      activity,
      notes: cell(record["یادداشت"]),
      status: status ?? "planned",
    })
  })

  return { rows, issues }
}

// ── IMPORT: COMMIT ─────────────────────────────────────────

/**
 * Write parsed rows as local drafts. Existing rows are never touched — an
 * import only adds. Every row goes through the offline repo so the queue picks
 * it up on the next sync.
 */
export async function commitImport(rows: ImportRow[]): Promise<number> {
  for (const row of rows) {
    // Built field by field: `row` is preview metadata and must never reach the
    // wire. TypeScript fails the build if ImportRow gains a field and this
    // literal falls behind.
    await createLocal("lesson_plans", db.lesson_plans, {
      date: row.date,
      class_id: row.class_id,
      subject_id: row.subject_id,
      period_id: row.period_id,
      start_time: row.start_time,
      end_time: row.end_time,
      activity: row.activity,
      notes: row.notes,
      status: row.status,
    })
  }
  return rows.length
}
