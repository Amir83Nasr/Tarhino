"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"

import { useLookups } from "@/features/teaching/hooks"
import { formatTime } from "@/lib/date/jalali"
import type { LessonPlan, LessonStatus } from "@/lib/api/types"

const STATUS_VARIANT: Record<
  LessonStatus,
  "secondary" | "default" | "destructive"
> = {
  planned: "secondary",
  done: "default",
  cancelled: "destructive",
}

export function LessonCard({
  plan,
  onSelect,
}: {
  plan: LessonPlan
  onSelect: () => void
}) {
  const { className, subjectName, periodLabel } = useLookups()
  const meta = [
    periodLabel(plan.period_id),
    className(plan.class_id),
    subjectName(plan.subject_id),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <li>
      <button type="button" onClick={onSelect} className="w-full text-start">
        <Card size="sm" className="transition-colors hover:bg-muted/50">
          <CardContent className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{plan.activity}</p>
              <p className="truncate text-xs text-muted-foreground">
                {meta || "بدون کلاس"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {plan.start_time && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(plan.start_time)}
                </span>
              )}
              <Badge variant={STATUS_VARIANT[plan.status]}>{plan.status}</Badge>
            </div>
          </CardContent>
        </Card>
      </button>
    </li>
  )
}
