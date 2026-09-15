"use client"

import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { ResponsiveDialog } from "@workspace/ui/components/responsive-dialog"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { PERSIAN_WEEKDAYS, formatTime } from "@/lib/date/jalali"
import type { Period, Subject, WeeklySlot } from "@/lib/api/types"

import {
  slotFor,
  useSaveSlotCell,
  type SlotCell,
} from "@/features/timetable/hooks"

// Saturday..Wednesday only; Thursday/Friday are school weekends.
export const TIMETABLE_DAYS = PERSIAN_WEEKDAYS.slice(0, 5)

type Props = {
  classId: string
  periods: Period[] | undefined
  slots: WeeklySlot[] | undefined
  subjects: Subject[] | undefined
}

export function TimetableGrid({ classId, periods, slots, subjects }: Props) {
  const [cell, setCell] = useState<SlotCell | null>(null)
  const save = useSaveSlotCell(classId)

  if (periods === undefined || slots === undefined || subjects === undefined) {
    return <TimetableSkeleton />
  }

  if (!periods.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-foreground/10 py-10 text-center">
        <p className="text-sm font-medium">هنوز زنگی برای این کلاس ثبت نشده</p>
        <p className="text-xs text-muted-foreground">
          اول از تنظیمات برای این کلاس زنگ بساز، بعد جدول را پر کن.
        </p>
      </div>
    )
  }

  const subjectName = (id: string) =>
    subjects.find((s) => s.id === id)?.name ?? "—"

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-150 border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-foreground/10 bg-muted/50 px-2 py-2 text-start font-medium">
                زنگ
              </th>
              {TIMETABLE_DAYS.map((day) => (
                <th
                  key={day}
                  className="border border-foreground/10 bg-muted/50 px-2 py-2 text-center font-medium"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id}>
                <td className="border border-foreground/10 px-2 py-2 align-top">
                  <div className="font-medium">{period.label}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {formatTime(period.start_time)} تا{" "}
                    {formatTime(period.end_time)}
                  </div>
                </td>
                {TIMETABLE_DAYS.map((_, weekday) => {
                  const found = slotFor(slots, weekday, period.id)
                  return (
                    <td
                      key={weekday}
                      className="border border-foreground/10 p-1"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCell({
                            weekday,
                            period_id: period.id,
                            slot: found,
                          })
                        }
                        className={cn(
                          "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-xs transition-colors",
                          found
                            ? "bg-primary/10 font-medium text-primary hover:bg-primary/15"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span>
                          {found ? subjectName(found.subject_id) : "—"}
                        </span>
                        {save.isPending && (
                          <span className="text-[10px] opacity-70">…</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ResponsiveDialog
        open={cell !== null}
        onOpenChange={(open) => {
          if (!open) setCell(null)
        }}
        title="درس این خانه"
        description={
          cell
            ? `${TIMETABLE_DAYS[cell.weekday]} — ${periods.find((p) => p.id === cell.period_id)?.label ?? ""}`
            : undefined
        }
      >
        {cell && (
          <SlotForm
            key={`${cell.weekday}-${cell.period_id}-${cell.slot?.id ?? "new"}`}
            cell={cell}
            classId={classId}
            subjects={subjects}
            busy={save.isPending}
            onPick={(subjectId) =>
              save.mutate(
                { cell, subject_id: subjectId },
                { onSuccess: () => setCell(null) }
              )
            }
          />
        )}
      </ResponsiveDialog>
    </>
  )
}

function SlotForm({
  cell,
  subjects,
  busy,
  onPick,
}: {
  cell: SlotCell
  classId: string
  subjects: Subject[]
  busy: boolean
  onPick: (subjectId: string | null) => void
}) {
  const [subjectId, setSubjectId] = useState(cell.slot?.subject_id ?? "")
  const items = subjects.map((s) => ({ value: s.id, label: s.name }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>درس</Label>
        <Select
          items={items}
          value={subjectId || null}
          onValueChange={(value) => setSubjectId(value ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="درس…" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              <SelectLabel>درس‌های این کلاس</SelectLabel>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!subjectId || busy}
          onClick={() => onPick(subjectId || null)}
          className="flex-1"
        >
          ذخیره
        </Button>
        {cell.slot && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onPick(null)}
          >
            خالی کن
          </Button>
        )}
      </div>
    </div>
  )
}

export function TimetableSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  )
}
