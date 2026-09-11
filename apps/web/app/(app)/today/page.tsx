"use client"

import { CalendarPlus, Plus } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { LessonCard, LessonCardSkeleton } from "@/features/teaching/lesson-card"
import { LessonDialog } from "@/features/teaching/lesson-dialog"
import { useHolidays, useLessonPlans } from "@/features/teaching/hooks"
import { formatFullDate, toISODate } from "@/lib/date/jalali"
import type { LessonPlan } from "@/lib/api/types"

export default function TodayPage() {
  const today = new Date()
  const iso = toISODate(today)
  const [editing, setEditing] = useState<LessonPlan | null>(null)
  const [open, setOpen] = useState(false)

  // undefined means Dexie has not answered yet; [] means genuinely empty.
  const plans = useLessonPlans(iso, iso)
  const holidays = useHolidays(iso, iso)

  function openNew() {
    setEditing(null)
    setOpen(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg">امروز</h1>
          <p className="text-sm text-muted-foreground">
            {formatFullDate(today)}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus />
          افزودن درس
        </Button>
      </div>

      {holidays?.map((holiday) => (
        <div
          key={holiday.id}
          className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          {holiday.title} — تعطیل
        </div>
      ))}

      {plans === undefined ? (
        <ul className="grid grid-cols-1 gap-2 md:gap-4 lg:grid-cols-2">
          <LessonCardSkeleton />
          <LessonCardSkeleton />
        </ul>
      ) : plans.length ? (
        <ul className="grid grid-cols-1 gap-2 md:gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
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
              <CalendarPlus className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">برای امروز درسی ثبت نشده</p>
              <p className="text-xs text-muted-foreground">
                اولین درس امروز را اضافه کنید تا برنامه‌تان شکل بگیرد.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <LessonDialog
        open={open}
        onOpenChange={setOpen}
        date={iso}
        plan={editing}
      />
    </div>
  )
}
