"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { useLookups } from "@/features/teaching/hooks"
import { formatNumericDate, fromISODate, weekdayName } from "@/lib/date/jalali"
import type { LessonPlan, Period } from "@/lib/api/types"

/** Day list order: smaller bell first. Unknown bell goes last. */
export function sortPlansByPeriod(
  plans: LessonPlan[],
  periods: Period[] | undefined
): LessonPlan[] {
  if (!periods?.length) return plans
  const byId = new Map(periods.map((p) => [p.id, p]))
  const orderOf = (plan: LessonPlan) =>
    byId.get(plan.period_id)?.order_index ?? Number.MAX_SAFE_INTEGER
  const startOf = (plan: LessonPlan) =>
    byId.get(plan.period_id)?.start_time ?? ""
  return [...plans].sort((a, b) => {
    const order = orderOf(a) - orderOf(b)
    if (order !== 0) return order
    const start = startOf(a)
    const end = startOf(b)
    return start < end ? -1 : start > end ? 1 : 0
  })
}

export function LessonTable({
  plans,
  onSelect,
}: {
  plans: LessonPlan[]
  onSelect: (plan: LessonPlan) => void
}) {
  const { subjectName, periodLabel } = useLookups()

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-xl text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-start font-medium">روز هفته</th>
            <th className="px-3 py-2 text-start font-medium">تاریخ</th>
            <th className="px-3 py-2 text-start font-medium">زنگ کلاس</th>
            <th className="px-3 py-2 text-start font-medium">نام درس</th>
            <th className="px-3 py-2 text-start font-medium">شرح فعالیت</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => {
            const date = fromISODate(plan.date)
            return (
              <tr
                key={plan.id}
                tabIndex={0}
                onClick={() => onSelect(plan)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelect(plan)
                  }
                }}
                className="cursor-pointer border-t border-foreground/10 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  {weekdayName(date)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatNumericDate(date)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {periodLabel(plan.period_id) ?? "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {subjectName(plan.subject_id) ?? "—"}
                </td>
                <td
                  title={plan.activity || "شرح بنویسید"}
                  className="max-w-56 truncate px-3 py-2 font-medium"
                >
                  {plan.activity || (
                    <span className="font-normal text-muted-foreground">
                      شرح بنویسید…
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Mirrors LessonTable so the swap to real data does not shift the layout. */
export function LessonTableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-xl text-sm">
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr
              key={index}
              className="border-t border-foreground/10 first:border-t-0"
            >
              <td className="px-3 py-2">
                <Skeleton className="h-4 w-12" />
              </td>
              <td className="px-3 py-2">
                <Skeleton className="h-4 w-20" />
              </td>
              <td className="px-3 py-2">
                <Skeleton className="h-4 w-12" />
              </td>
              <td className="px-3 py-2">
                <Skeleton className="h-4 w-16" />
              </td>
              <td className="px-3 py-2">
                <Skeleton className="h-4 w-3/4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
