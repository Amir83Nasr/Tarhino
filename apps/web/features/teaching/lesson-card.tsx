"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useLookups } from "@/features/teaching/hooks"
import { formatTime } from "@/lib/date/jalali"
import type { LessonPlan, LessonStatus } from "@/lib/api/types"

export const STATUS_LABELS: Record<LessonStatus, string> = {
  planned: "برنامه‌ریزی‌شده",
  done: "انجام شد",
  cancelled: "لغو شد",
}

export const STATUS_VARIANT: Record<
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
              <Badge variant={STATUS_VARIANT[plan.status]}>
                {STATUS_LABELS[plan.status]}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </button>
    </li>
  )
}

/** Mirrors LessonCard so the swap to real data does not shift the layout. */
export function LessonCardSkeleton() {
  return (
    <li>
      <Card size="sm">
        <CardContent className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </CardContent>
      </Card>
    </li>
  )
}
