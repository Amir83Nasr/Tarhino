"use client"

import {
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
} from "lucide-react"
import { useState } from "react"
import dynamic from "next/dynamic"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { LessonCard, LessonCardSkeleton } from "@/features/teaching/lesson-card"

// The dialog (form + Jalali picker + selects) loads on first open, not with
// the page: week renders and navigates without carrying its weight.
const LessonDialog = dynamic(
  () => import("@/features/teaching/lesson-dialog").then((m) => m.LessonDialog),
  { ssr: false }
)
import {
  LessonTable,
  LessonTableSkeleton,
  ViewToggle,
  useLessonView,
} from "@/features/teaching/lesson-table"
import {
  prefetchWeek,
  useHolidays,
  useLessonPlans,
  useLookups,
} from "@/features/teaching/hooks"
import {
  addDays,
  formatNumericDate,
  formatShortDate,
  formatTime,
  fromISODate,
  isSameDay,
  isSchoolWeekend,
  monthName,
  startOfWeek,
  today,
  toISODate,
  toJalali,
  toPersianDigits,
  weekDays,
  weekdayName,
} from "@/lib/date/jalali"
import type { LessonPlan } from "@/lib/api/types"

export default function WeekPage() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  const [editing, setEditing] = useState<LessonPlan | null>(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useLessonView()
  const [printScope, setPrintScope] = useState<"day" | "week">("week")

  function select(plan: LessonPlan) {
    setEditing(plan)
    setOpen(true)
  }

  // Browser print doubles as free PDF export. printScope locks what the
  // preview shows before/after the dialog opens (one day or the full week),
  // then afterprint restores the on-screen state.
  useEffect(() => {
    function restore() {
      setPrintScope("week")
    }
    window.addEventListener("afterprint", restore)
    return () => window.removeEventListener("afterprint", restore)
  }, [])

  function printPlan(scope: "day" | "week") {
    setPrintScope(scope)
    // Let React commit the matching preview before the print dialog opens.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }

  const days = weekDays(anchor)
  const from = toISODate(days[0] ?? anchor)
  const to = toISODate(days[6] ?? anchor)
  const selectedIso = toISODate(selected)

  const plans = useLessonPlans(from, to)
  const holidays = useHolidays(from, to)
  const selectedPlans = plans?.filter((p) => p.date === selectedIso) ?? []
  const selectedHoliday = holidays?.find((h) => h.date === selectedIso)

  // Nights and weekends are free: warm the adjacent weeks so shifting feels
  // instant instead of fetching on click.
  const client = useQueryClient()
  useEffect(() => {
    const prev = addDays(anchor, -7)
    const next = addDays(anchor, 7)
    prefetchWeek(
      client,
      toISODate(startOfWeek(prev)),
      toISODate(addDays(startOfWeek(prev), 6))
    )
    prefetchWeek(
      client,
      toISODate(startOfWeek(next)),
      toISODate(addDays(startOfWeek(next), 6))
    )
  }, [anchor, client])

  const weekStart = toJalali(startOfWeek(anchor))

  function shiftWeek(delta: number) {
    const next = addDays(anchor, delta * 7)
    setAnchor(next)
    setSelected(startOfWeek(next))
  }

  const todayIso = toISODate(today())
  const isTodaySelected = selectedIso === todayIso

  function goToday() {
    const now = today()
    setAnchor(now)
    setSelected(now)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-6">
      <PrintPreview
        scope={printScope}
        days={days}
        plans={plans ?? []}
        holidays={holidays ?? []}
        selectedIso={selectedIso}
      />
      <h1 className="text-lg print:hidden">برنامه</h1>
      <header className="mx-auto flex w-full max-w-lg items-center justify-between print:hidden">
        <Button size="sm" variant="ghost" onClick={() => shiftWeek(-1)}>
          <ChevronRight />
          هفته قبل
        </Button>
        <span className="text-sm font-medium">
          {monthName(weekStart.month)} {toPersianDigits(weekStart.year)}
        </span>
        <Button size="sm" variant="ghost" onClick={() => shiftWeek(1)}>
          هفته بعد
          <ChevronLeft />
        </Button>
      </header>

      <ul className="mx-auto grid w-full max-w-md grid-cols-7 gap-1 print:hidden">
        {days.map((day) => {
          const active = isSameDay(day, selected)
          const off = isSchoolWeekend(day)
          const isToday = toISODate(day) === todayIso
          return (
            <li key={day.toISOString()}>
              <button
                type="button"
                onClick={() => setSelected(day)}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-lg py-2 text-xs",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                  !active && isToday && "ring-1 ring-primary ring-inset"
                )}
              >
                <span>{weekdayName(day).slice(0, 1)}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    !active && off && "text-destructive"
                  )}
                >
                  {toPersianDigits(toJalali(day).day)}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "size-1 rounded-full",
                    isToday && !active && "bg-primary"
                  )}
                />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h2 className="text-sm font-medium">{formatShortDate(selected)}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle mode={mode} onChange={setMode} />
          <Button
            size="sm"
            variant="outline"
            onClick={goToday}
            disabled={isTodaySelected}
            title="بازگشت به امروز"
          >
            <CalendarDays />
            امروز
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus />
            افزودن درس
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => printPlan("day")}
            disabled={plans === undefined}
            title="خروجی PDF برنامه امروز"
          >
            <Printer />
            <span className="hidden sm:inline">چاپ روز</span>
            <span className="sm:hidden">روز</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => printPlan("week")}
            disabled={plans === undefined}
            title="خروجی PDF برنامه هفته"
          >
            <Printer />
            <span className="hidden sm:inline">چاپ هفته</span>
            <span className="sm:hidden">هفته</span>
          </Button>
        </div>
      </div>

      {selectedHoliday && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground print:hidden">
          {selectedHoliday.title} — تعطیل
        </div>
      )}

      <div className="contents print:hidden">
        {plans === undefined ? (
          mode === "table" ? (
            <LessonTableSkeleton rows={1} />
          ) : (
            <ul className="grid grid-cols-1 gap-2 md:gap-4 lg:grid-cols-2">
              <LessonCardSkeleton />
            </ul>
          )
        ) : selectedPlans.length ? (
          mode === "table" ? (
            <LessonTable plans={selectedPlans} onSelect={select} />
          ) : (
            <ul className="grid grid-cols-1 gap-2 md:gap-4 lg:grid-cols-2">
              {selectedPlans.map((plan) => (
                <LessonCard
                  key={plan.id}
                  plan={plan}
                  onSelect={() => select(plan)}
                />
              ))}
            </ul>
          )
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CalendarOff className="size-6" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">این روز خالی است</p>
                <p className="text-xs text-muted-foreground">
                  برای این روز درسی ثبت نشده.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <LessonDialog
        open={open}
        onOpenChange={setOpen}
        date={selectedIso}
        plan={editing}
      />
    </div>
  )
}

// ── PRINT ──────────────────────────────────────────────────
// Screen shows one day at a time; paper shows the glanceable sheet:
// day view = that day's rows, week view = one row per day of the week.
// Hidden on screen (print-only), everything else hides on paper (print:hidden).

function PrintPreview({
  scope,
  days,
  plans,
  holidays,
  selectedIso,
}: {
  scope: "day" | "week"
  days: Date[]
  plans: LessonPlan[]
  holidays: { date: string; title: string }[]
  selectedIso: string
}) {
  const { className, subjectName, periodLabel } = useLookups()

  const showDays =
    scope === "day"
      ? days.filter((day) => toISODate(day) === selectedIso)
      : days

  const heading =
    scope === "day"
      ? formatShortDate(fromISODate(selectedIso))
      : `${formatNumericDate(days[0] ?? new Date())} تا ${formatNumericDate(days[6] ?? new Date())}`

  return (
    <section aria-hidden className="hidden print:block" dir="rtl">
      <div className="mb-3 flex items-baseline justify-between border-b-2 border-black pb-2">
        <h1 className="text-base font-bold">
          {scope === "day" ? "برنامه روز" : "برنامه هفته"} — طرحینو
        </h1>
        <p className="text-xs">{heading}</p>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 text-start">روز</th>
            <th className="border border-black px-2 py-1 text-start">فعالیت</th>
            <th className="border border-black px-2 py-1 text-start">کلاس</th>
            <th className="border border-black px-2 py-1 text-start">درس</th>
            <th className="border border-black px-2 py-1 text-start">زنگ</th>
            <th className="border border-black px-2 py-1 text-start">ساعت</th>
          </tr>
        </thead>
        <tbody>
          {showDays.map((day) => {
            const iso = toISODate(day)
            const rows = plans.filter((p) => p.date === iso)
            const holiday = holidays.find((h) => h.date === iso)
            const label = `${weekdayName(day)} ${formatNumericDate(day)}`
            if (!rows.length) {
              return (
                <tr key={iso}>
                  <td className="border border-black px-2 py-1 font-bold">
                    {label}
                  </td>
                  <td
                    colSpan={5}
                    className="border border-black px-2 py-1 text-neutral-500"
                  >
                    {holiday ? `${holiday.title} — تعطیل` : "—"}
                  </td>
                </tr>
              )
            }
            return rows.map((plan, i) => (
              <tr key={plan.id} className="break-inside-avoid">
                {i === 0 && (
                  <td
                    rowSpan={rows.length}
                    className="border border-black px-2 py-1 align-top font-bold"
                  >
                    {label}
                  </td>
                )}
                <td className="border border-black px-2 py-1">
                  {plan.activity}
                  {plan.notes ? ` — ${plan.notes}` : ""}
                </td>
                <td className="border border-black px-2 py-1">
                  {className(plan.class_id) ?? "—"}
                </td>
                <td className="border border-black px-2 py-1">
                  {subjectName(plan.subject_id) ?? "—"}
                </td>
                <td className="border border-black px-2 py-1">
                  {periodLabel(plan.period_id) ?? "—"}
                </td>
                <td className="border border-black px-2 py-1 whitespace-nowrap">
                  {planTime(plan)}
                </td>
              </tr>
            ))
          })}
        </tbody>
      </table>
    </section>
  )
}

function planTime(plan: LessonPlan): string {
  const parts = [plan.start_time, plan.end_time]
    .filter(Boolean)
    .map((time) => formatTime(time as string))
  return parts.length ? parts.join(" تا ") : "—"
}
