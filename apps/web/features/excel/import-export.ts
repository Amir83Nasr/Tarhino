"use client"

import {
  createLessonPlan,
  listClasses,
  listLessonPlans,
  listPeriods,
  listSubjects,
} from "@/features/teaching/api"
import {
  formatNumericDate,
  fromISODate,
  parseJalali,
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
// POSTs rows to the server.

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
      return {
        تاریخ: formatNumericDate(fromISODate(plan.date)),
        کلاس: className.get(plan.class_id) ?? "",
        درس: subjectName.get(plan.subject_id) ?? "",
        زنگ: periodName.get(plan.period_id) ?? "",
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
  // xlsx is heavy: load it only when the teacher actually exports, so it
  // never lands in the initial page bundle. Callers already show busy state.
  const XLSX = await import("xlsx")
  const [plans, classes, subjects, periods] = await Promise.all([
    listLessonPlans(from, to),
    listClasses(),
    listSubjects(),
    listPeriods(),
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

/** A validated row, ready to become a lesson plan. Strict tree: class, subject and period are always present. */
export type ImportRow = {
  row: number
  date: string
  class_id: string
  subject_id: string
  period_id: string
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
  const XLSX = await import("xlsx")
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
  // Bells live under a class: the same label can repeat across classes.
  const periodByClass = new Map(
    lookups.periods.map((p) => [`${p.class_id}|${p.label.trim()}`, p])
  )

  const existing = new Set(
    (await listLessonPlans("0000-01-01", "9999-12-31")).map(
      (plan) => `${plan.date}|${plan.period_id}`
    )
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
      fail("تاریخ خوانده نشد (نمونه: ۱۴۰۵٫۰۵٫۱۵)")
      return
    }

    const activity = cell(record["فعالیت"])
    if (!activity) {
      fail("فعالیت خالی است")
      return
    }

    const className = cell(record["کلاس"])
    const class_id = className ? (classId.get(className) ?? null) : null
    if (!class_id) {
      fail(className ? `کلاس «${className}» پیدا نشد` : "کلاس خالی است")
      return
    }

    const subjectName = cell(record["درس"])
    const subject_id = subjectName ? (subjectId.get(subjectName) ?? null) : null
    if (!subject_id) {
      fail(subjectName ? `درس «${subjectName}» پیدا نشد` : "درس خالی است")
      return
    }

    const periodLabel = cell(record["زنگ"])
    const period = periodLabel
      ? (periodByClass.get(`${class_id}|${periodLabel}`) ?? null)
      : null
    if (!period) {
      fail(
        periodLabel
          ? `زنگ «${periodLabel}» در این کلاس پیدا نشد`
          : "زنگ خالی است"
      )
      return
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

    if (existing.has(`${date}|${period.id}`)) {
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
      period_id: period.id,
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
 * POST parsed rows to the server. Existing rows are never touched — an import
 * only adds. Requests run 5 at a time: one slow Neon round-trip no longer
 * blocks the whole file.
 */
export async function commitImport(rows: ImportRow[]): Promise<{
  count: number
  saved: LessonPlan[]
}> {
  const saved: LessonPlan[] = []
  const queue = rows.map(
    (row) => () =>
      // Built field by field: `row` is preview metadata and must never reach
      // the wire. TypeScript fails the build if ImportRow gains a field and
      // this literal falls behind.
      createLessonPlan({
        date: row.date,
        class_id: row.class_id,
        subject_id: row.subject_id,
        period_id: row.period_id,
        start_time: row.start_time,
        end_time: row.end_time,
        activity: row.activity,
        notes: row.notes,
        status: row.status,
      }).then((plan) => void saved.push(plan))
  )
  await Promise.all(
    Array.from({ length: Math.min(5, queue.length) }, async () => {
      while (queue.length) await queue.shift()?.()
    })
  )
  return { count: rows.length, saved }
}
