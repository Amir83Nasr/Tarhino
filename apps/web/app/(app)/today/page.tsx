"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { LessonCard } from "@/features/teaching/lesson-card"
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
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-lg">امروز</h1>
          <p className="text-sm text-muted-foreground">
            {formatFullDate(today)}
          </p>
        </div>
        <Button size="icon" onClick={openNew} aria-label="افزودن درس">
          <Plus />
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
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : plans.length ? (
        <ul className="flex flex-col gap-2">
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
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            برای امروز درسی ثبت نشده.
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
