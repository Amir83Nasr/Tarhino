"use client"

import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { LessonCard } from "@/features/teaching/lesson-card"
import { LessonDialog } from "@/features/teaching/lesson-dialog"
import { useLessonPlans } from "@/features/teaching/hooks"
import {
  addDays,
  formatShortDate,
  isSameDay,
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
  const selectedPlans = plans?.filter((p) => p.date === selectedIso) ?? []

  const weekStart = toJalali(startOfWeek(anchor))

  function shiftWeek(delta: number) {
    const next = addDays(anchor, delta * 7)
    setAnchor(next)
    setSelected(startOfWeek(next))
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <header className="flex items-center justify-between">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => shiftWeek(-1)}
          aria-label="هفته قبل"
        >
          <ChevronRight />
        </Button>
        <span className="text-sm font-medium">
          {monthName(weekStart.month)} {toPersianDigits(weekStart.year)}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => shiftWeek(1)}
          aria-label="هفته بعد"
        >
          <ChevronLeft />
        </Button>
      </header>

      <ul className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const active = isSameDay(day, selected)
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
                <span className="tabular-nums">
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
          size="icon-sm"
          variant="outline"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
          aria-label="افزودن درس"
        >
          <Plus />
        </Button>
      </div>

      {plans === undefined ? (
        <Skeleton className="h-20 w-full" />
      ) : selectedPlans.length ? (
        <ul className="flex flex-col gap-2">
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
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            این روز خالی است.
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
