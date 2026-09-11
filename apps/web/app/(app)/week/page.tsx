"use client"

import {
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Plus,
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
} from "@/features/teaching/hooks"
import {
  addDays,
  formatShortDate,
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

  function select(plan: LessonPlan) {
    setEditing(plan)
    setOpen(true)
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
      <h1 className="text-lg">برنامه</h1>
      <header className="mx-auto flex w-full max-w-lg items-center justify-between">
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

      <ul className="mx-auto grid w-full max-w-md grid-cols-7 gap-1">
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

      <div className="flex flex-wrap items-center justify-between gap-2">
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
        </div>
      </div>

      {selectedHoliday && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {selectedHoliday.title} — تعطیل
        </div>
      )}

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

      <LessonDialog
        open={open}
        onOpenChange={setOpen}
        date={selectedIso}
        plan={editing}
      />
    </div>
  )
}
