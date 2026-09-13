"use client"

import { LayoutGrid, Table2 } from "lucide-react"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useLookups } from "@/features/teaching/hooks"
import { STATUS_LABELS, STATUS_VARIANT } from "@/features/teaching/lesson-card"
import { formatTime } from "@/lib/date/jalali"
import type { LessonPlan } from "@/lib/api/types"

export type ViewMode = "card" | "table"

const STORAGE_KEY = "tarhino:lesson-view"

function storedMode(): ViewMode {
  // Lazy init runs only in the browser: no SSR mismatch, no sync effect.
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "table"
      ? "table"
      : "card"
  } catch {
    // Private mode or blocked storage: stay on cards.
    return "card"
  }
}

export function useLessonView(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(storedMode)

  function change(next: ViewMode) {
    setMode(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: mode just won't persist.
    }
  }

  return [mode, change]
}

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
      role="group"
      aria-label="حالت نمایش"
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange("card")}
        aria-label="نمایش کارتی"
        aria-pressed={mode === "card"}
        title="نمایش کارتی"
        className={
          mode === "card"
            ? "rounded-md bg-background text-foreground shadow-sm hover:bg-background"
            : "rounded-md text-muted-foreground"
        }
      >
        <LayoutGrid />
        کارتی
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange("table")}
        aria-label="نمایش جدولی"
        aria-pressed={mode === "table"}
        title="نمایش جدولی"
        className={
          mode === "table"
            ? "rounded-md bg-background text-foreground shadow-sm hover:bg-background"
            : "rounded-md text-muted-foreground"
        }
      >
        <Table2 />
        جدولی
      </Button>
    </div>
  )
}

export function LessonTable({
  plans,
  onSelect,
}: {
  plans: LessonPlan[]
  onSelect: (plan: LessonPlan) => void
}) {
  const { className, subjectName, periodLabel } = useLookups()

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-xl text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-start font-medium">فعالیت</th>
            <th className="px-3 py-2 text-start font-medium">کلاس</th>
            <th className="px-3 py-2 text-start font-medium">درس</th>
            <th className="px-3 py-2 text-start font-medium">زنگ</th>
            <th className="px-3 py-2 text-start font-medium">ساعت</th>
            <th className="px-3 py-2 text-start font-medium">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
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
              <td
                title={plan.activity}
                className="max-w-56 truncate px-3 py-2 font-medium"
              >
                {plan.activity}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {className(plan.class_id) ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {subjectName(plan.subject_id) ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {periodLabel(plan.period_id) ?? "—"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                {timeRange(plan)}
              </td>
              <td className="px-3 py-2">
                <Badge variant={STATUS_VARIANT[plan.status]}>
                  {STATUS_LABELS[plan.status]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function timeRange(plan: LessonPlan): string {
  const parts = [plan.start_time, plan.end_time]
    .filter(Boolean)
    .map((time) => formatTime(time as string))
  return parts.length ? parts.join(" تا ") : "—"
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
                <Skeleton className="h-4 w-3/4" />
              </td>
              <td className="px-3 py-2">
                <Skeleton className="h-4 w-16" />
              </td>
              <td className="px-3 py-2">
                <Skeleton className="h-4 w-16" />
              </td>
              <td className="px-3 py-2">
                <Skeleton className="h-4 w-12" />
              </td>
              <td className="px-3 py-2">
                <Skeleton className="h-4 w-20" />
              </td>
              <td className="px-3 py-2">
                <Skeleton className="h-5 w-14 rounded-full" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
