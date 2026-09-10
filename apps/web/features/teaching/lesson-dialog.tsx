"use client"

import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { toast } from "@workspace/ui/components/sonner"

import {
  useLookups,
  useSaveLessonPlan,
  type LessonPlanInput,
} from "@/features/teaching/hooks"
import type { LessonPlan, LessonStatus } from "@/lib/api/types"

const STATUS_LABELS: Record<LessonStatus, string> = {
  planned: "برنامه‌ریزی‌شده",
  done: "انجام شد",
  cancelled: "لغو شد",
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  plan?: LessonPlan | null
}

export function LessonDialog({ open, onOpenChange, date, plan = null }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? "ویرایش درس" : "درس جدید"}</DialogTitle>
          <DialogDescription>
            برای این زنگ چه کاری انجام می‌دهید؟
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: fields seed from `plan` without a sync effect. */}
        {open && (
          <LessonForm
            key={plan?.id ?? "new"}
            date={date}
            plan={plan}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function LessonForm({
  date,
  plan,
  onDone,
}: {
  date: string
  plan: LessonPlan | null
  onDone: () => void
}) {
  const { classes, subjects, periods, period } = useLookups()

  const [activity, setActivity] = useState(plan?.activity ?? "")
  const [classId, setClassId] = useState(plan?.class_id ?? "")
  const [subjectId, setSubjectId] = useState(plan?.subject_id ?? "")
  const [periodId, setPeriodId] = useState(plan?.period_id ?? "")
  const [startTime, setStartTime] = useState(
    plan?.start_time?.slice(0, 5) ?? ""
  )
  const [endTime, setEndTime] = useState(plan?.end_time?.slice(0, 5) ?? "")
  const [status, setStatus] = useState<LessonStatus>(plan?.status ?? "planned")

  const save = useSaveLessonPlan(plan, onDone)

  function pickPeriod(id: string) {
    setPeriodId(id)
    const chosen = period(id)
    // Times come from the bell schedule unless the teacher already set them.
    if (chosen && !startTime && !endTime) {
      setStartTime(chosen.start_time.slice(0, 5))
      setEndTime(chosen.end_time.slice(0, 5))
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!activity.trim()) {
      toast.error("شرح فعالیت را وارد کنید")
      return
    }

    const input: LessonPlanInput = {
      date,
      activity: activity.trim(),
      class_id: classId || null,
      subject_id: subjectId || null,
      period_id: periodId || null,
      start_time: startTime || null,
      end_time: endTime || null,
      status,
    }
    save.mutate(input, {
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "ذخیره نشد"),
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity">فعالیت</Label>
        <Input
          id="activity"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          placeholder="مثلاً حل تمرین‌های فصل ۳"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="class">کلاس</Label>
          <select
            id="class"
            className={selectClass}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">—</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subject">درس</Label>
          <select
            id="subject"
            className={selectClass}
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="period">زنگ</Label>
        <select
          id="period"
          className={selectClass}
          value={periodId}
          onChange={(e) => pickPeriod(e.target.value)}
        >
          <option value="">—</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start">شروع</Label>
          <Input
            id="start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="end">پایان</Label>
          <Input
            id="end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">وضعیت</Label>
          <select
            id="status"
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as LessonStatus)}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          انصراف
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "در حال ذخیره…" : "ذخیره"}
        </Button>
      </DialogFooter>
    </form>
  )
}
