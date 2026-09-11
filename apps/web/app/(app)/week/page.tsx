"use client"

import { CalendarOff, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { LessonCard, LessonCardSkeleton } from "@/features/teaching/lesson-card"
import { LessonDialog } from "@/features/teaching/lesson-dialog"
import { useHolidays, useLessonPlans } from "@/features/teaching/hooks"
import {
  addDays,
  formatShortDate,
  isSameDay,
  isSchoolWeekend,
  monthName,
  startOfWeek,
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

  const days = weekDays(anchor)
  const from = toISODate(days[0] ?? anchor)
  const to = toISODate(days[6] ?? anchor)
  const selectedIso = toISODate(selected)

  const plans = useLessonPlans(from, to)
  const holidays = useHolidays(from, to)
  const selectedPlans = plans?.filter((p) => p.date === selectedIso) ?? []
  const selectedHoliday = holidays?.find((h) => h.date === selectedIso)

  const weekStart = toJalali(startOfWeek(anchor))

  function shiftWeek(delta: number) {
    const next = addDays(anchor, delta * 7)
    setAnchor(next)
    setSelected(startOfWeek(next))
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-6">
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
          return (
            <li key={day.toISOString()}>
              <button
                type="button"
                onClick={() => setSelected(day)}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-lg py-2 text-xs",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
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
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{formatShortDate(selected)}</h2>
        <Button
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

      {selectedHoliday && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {selectedHoliday.title} — تعطیل
        </div>
      )}

      {plans === undefined ? (
        <ul className="grid grid-cols-1 gap-2 md:gap-4 lg:grid-cols-2">
          <LessonCardSkeleton />
        </ul>
      ) : selectedPlans.length ? (
        <ul className="grid grid-cols-1 gap-2 md:gap-4 lg:grid-cols-2">
          {selectedPlans.map((plan) => (
            <LessonCard
              key={plan.id}
              plan={plan}
              onSelect={() => {
                setEditing(plan)
                setOpen(true)
              }}
            />
          ))}
        </ul>
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
