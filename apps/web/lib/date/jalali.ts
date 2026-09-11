import { toGregorian as jalaaliToGregorian, toJalaali } from "jalaali-js"

// All Jalali/Persian presentation lives here. Components call these helpers and
// never touch Intl or jalaali-js directly. Dates are stored Gregorian everywhere
// else in the app (API, Dexie) — this module is the only conversion boundary.

const FA_LOCALE = "fa-IR-u-ca-persian"
const TEHRAN_TZ = "Asia/Tehran"

export const PERSIAN_WEEKDAYS = [
  "شنبه",
  "یک‌شنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه",
] as const

export const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const

// Saturday is the first day of the Iranian week; getDay() is Sunday-based, so
// Saturday (6) shifts to 0 and Friday (5) to 6.
const SATURDAY_OFFSET = 1

// ── CONVERSION ─────────────────────────────────────────────

export type Jalali = { year: number; month: number; day: number }

export function toJalali(date: Date): Jalali {
  const { jy, jm, jd } = toJalaali(date)
  return { year: jy, month: jm, day: jd }
}

export function toGregorian({ year, month, day }: Jalali): Date {
  const { gy, gm, gd } = jalaaliToGregorian(year, month, day)
  return new Date(gy, gm - 1, gd)
}

// ── FORMATTING ─────────────────────────────────────────────

export function formatJalali(
  date: Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat(FA_LOCALE, {
    timeZone: TEHRAN_TZ,
    ...options,
  }).format(date)
}

export function monthName(month: number): string {
  return PERSIAN_MONTHS[month - 1] ?? ""
}

export function weekdayName(date: Date): string {
  return PERSIAN_WEEKDAYS[weekdayIndex(date)] ?? ""
}

export function formatShortDate(date: Date): string {
  const { day, month } = toJalali(date)
  return `${toPersianDigits(day)} ${monthName(month)}`
}

/** Numeric Jalali date in the app-wide glyph style: ۱۴۰۵٫۰۵٫۰۵. */
export function formatNumericDate(date: Date): string {
  const { day, month, year } = toJalali(date)
  const pad = (n: number) => String(n).padStart(2, "0")
  return toPersianDigits(`${year}٫${pad(month)}٫${pad(day)}`)
}

export function formatFullDate(date: Date): string {
  const { day, month, year } = toJalali(date)
  return `${weekdayName(date)} ${toPersianDigits(day)} ${monthName(month)} ${toPersianDigits(year)}`
}

export function formatTime(time: string): string {
  // Accepts "HH:MM" or "HH:MM:SS" from the API.
  const [hours = "00", minutes = "00"] = time.split(":")
  return toPersianDigits(`${hours}:${minutes}`)
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS.charAt(Number(d)))
}

export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
}

// ── ARITHMETIC ─────────────────────────────────────────────

export function today(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Saturday-based index: 0 = شنبه … 6 = جمعه. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + SATURDAY_OFFSET) % 7
}

/** Saturday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -weekdayIndex(date))
}

export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function isWeekend(date: Date): boolean {
  return weekdayIndex(date) === 6 // جمعه
}

/** پنج‌شنبه و جمعه — تعطیل رسمی مدارس ابتدایی. */
export function isSchoolWeekend(date: Date): boolean {
  const index = weekdayIndex(date)
  return index === 5 || index === 6
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** ISO yyyy-mm-dd in local time — the wire format the API expects for `date`. */
export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function fromISODate(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.split("-").map(Number)
  return new Date(year, month - 1, day)
}

// ── JALALI INPUT ───────────────────────────────────────────

/**
 * Teacher-typed Jalali date — "۱۴۰۴/۰۳/۱۵", "1404-3-15", "۱۴۰۵٫۰۵٫۰۵" — to an
 * ISO Gregorian date, or null if it is not a real day.
 *
 * jalaali-js never throws on overflow, it rolls: 1404/12/30 (1404 is a 365-day
 * year) comes back as 1405/01/01, and 1404/13/1 as 1405/01/02. The round-trip
 * comparison below is what actually rejects those — without it an import would
 * silently move a lesson plan to a different day.
 */
export function parseJalali(value: string): string | null {
  const parts = value
    .split(/[/\-.٫]/) // ٫ — the glyph separator the app displays
    .map((part) => Number(toLatinDigits(part).trim()))
  if (parts.length !== 3) return null

  const [year, month, day] = parts as [number, number, number]
  if (!year || !month || !day || month > 12 || day > 31) return null
  // A Gregorian date pasted into a Jalali column reads as a plausible year
  // (2025/06/05). 1300–1500 spans 1921–2121 and rejects that outright.
  if (year < 1300 || year > 1500) return null

  try {
    const gregorian = toGregorian({ year, month, day })
    if (Number.isNaN(gregorian.getTime())) return null

    const back = toJalali(gregorian)
    if (back.year !== year || back.month !== month || back.day !== day)
      return null
    return toISODate(gregorian)
  } catch {
    return null
  }
}
