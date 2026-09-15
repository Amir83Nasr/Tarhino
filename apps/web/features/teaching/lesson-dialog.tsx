"use client"

import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { DialogFooter } from "@workspace/ui/components/dialog"
import { ResponsiveDialog } from "@workspace/ui/components/responsive-dialog"
import { Input } from "@workspace/ui/components/input"
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
import { toast } from "@workspace/ui/components/sonner"

import { TimeInput } from "@/components/time-input"
import {
  useClassSubjects,
  useDeleteLessonPlan,
  useLookups,
  usePeriodsByClass,
  useSaveLessonPlan,
  type LessonPlanInput,
} from "@/features/teaching/hooks"
import type { LessonPlan, LessonStatus } from "@/lib/api/types"
import { ApiError } from "@/lib/api/client"

const STATUS_LABELS: Record<LessonStatus, string> = {
  planned: "برنامه‌ریزی‌شده",
  done: "انجام شد",
  cancelled: "لغو شد",
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  plan?: LessonPlan | null
}

export function LessonDialog({ open, onOpenChange, date, plan = null }: Props) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={plan ? "ویرایش درس" : "درس جدید"}
      description="برای این زنگ چه کاری انجام می‌دهید؟"
    >
      {/* Mounted only while open: fields seed from `plan` without a sync effect. */}
      {open && (
        <LessonForm
          key={plan?.id ?? "new"}
          date={date}
          plan={plan}
          onDone={() => onOpenChange(false)}
        />
      )}
    </ResponsiveDialog>
  )
}

function LessonForm({
  date: dateProp,
  plan,
  onDone,
}: {
  date: string
  plan: LessonPlan | null
  onDone: () => void
}) {
  const { classes, subjects } = useLookups()

  const [activity, setActivity] = useState(plan?.activity ?? "")
  const [date] = useState(dateProp ?? "")
  const [classId, setClassId] = useState(plan?.class_id ?? "")
  const [subjectId, setSubjectId] = useState(plan?.subject_id ?? "")
  const [periodId, setPeriodId] = useState(plan?.period_id ?? "")

  const classItems = classes.map((c) => ({ label: c.name, value: c.id }))
  // Subjects narrow to the chosen class's links; unlinked picks are rejected
  // server-side with a 422 toast (see submit below).
  const links = useClassSubjects(classId || null)
  const linkedIds =
    links === undefined ? null : new Set(links.map((l) => l.subject_id))
  const subjectItems = subjects
    .filter((s) => linkedIds === null || linkedIds.has(s.id))
    .map((s) => ({ label: s.name, value: s.id }))
  // Bells belong to the class: switching class resets a stale period pick.
  const classPeriods = usePeriodsByClass(classId || null)
  const periodItems = (classPeriods ?? []).map((p) => ({
    label: p.label,
    value: p.id,
  }))

  function pickClass(id: string) {
    setClassId(id)
    // Subjects and bells belong to the class: drop stale picks.
    setSubjectId("")
    setPeriodId("")
  }
  const statusItems = Object.entries(STATUS_LABELS).map(([value, label]) => ({
    label,
    value,
  }))
  const [startTime, setStartTime] = useState(
    plan?.start_time?.slice(0, 5) ?? ""
  )
  const [endTime, setEndTime] = useState(plan?.end_time?.slice(0, 5) ?? "")
  const [status, setStatus] = useState<LessonStatus>(plan?.status ?? "planned")

  const save = useSaveLessonPlan(plan, onDone)
  const remove = useDeleteLessonPlan()

  function deletePlan() {
    if (!plan) return
    remove.mutate(plan.id, {
      onSuccess: onDone,
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "حذف نشد"),
    })
  }

  function pickPeriod(id: string) {
    setPeriodId(id)
    const chosen = (classPeriods ?? []).find((p) => p.id === id)
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
    if (!classId || !subjectId || !periodId) {
      toast.error("کلاس، درس و زنگ را انتخاب کنید")
      return
    }

    const input: LessonPlanInput = {
      date,
      activity: activity.trim(),
      class_id: classId,
      subject_id: subjectId,
      period_id: periodId,
      start_time: startTime || null,
      end_time: endTime || null,
      status,
    }
    save.mutate(input, {
      onError: (error) =>
        // ApiError messages are Persian (translated in client.ts); anything
        // else (browser/network internals) must not leak English into the toast.
        toast.error(error instanceof ApiError ? error.message : "ذخیره نشد"),
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity">فعالیت</Label>
        {/* No autoFocus: desktop Dialog focuses first field itself;
            on mobile any autofocus pops the virtual keyboard over the drawer. */}
        <Input
          id="activity"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          placeholder="مثلاً حل تمرین‌های فصل ۳"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>کلاس</Label>
          <Select
            items={classItems}
            value={classId || null}
            onValueChange={(value) => value && pickClass(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="کلاس…" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectLabel>کلاس‌ها</SelectLabel>
                {classItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>درس</Label>
          <Select
            items={subjectItems}
            value={subjectId || null}
            onValueChange={(value) => setSubjectId(value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="درس…" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectLabel>درس‌ها</SelectLabel>
                {subjectItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>زنگ</Label>
        <Select
          items={periodItems}
          value={periodId || null}
          onValueChange={(value) => pickPeriod(value ?? "")}
          disabled={!classId}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={classId ? "زنگ…" : "اول کلاس را انتخاب کنید"}
            />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              <SelectLabel>زنگ‌ها</SelectLabel>
              {periodItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start">شروع</Label>
          <TimeInput
            id="start"
            value={startTime}
            onChange={setStartTime}
            aria-label="ساعت شروع"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="end">پایان</Label>
          <TimeInput
            id="end"
            value={endTime}
            onChange={setEndTime}
            aria-label="ساعت پایان"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>وضعیت</Label>
          <Select
            items={statusItems}
            value={status}
            onValueChange={(value) => setStatus(value as LessonStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectLabel>وضعیت</SelectLabel>
                {statusItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        {plan && (
          <Button
            type="button"
            variant="destructive"
            className="sm:me-auto"
            disabled={remove.isPending}
            onClick={deletePlan}
          >
            {remove.isPending ? "در حال حذف…" : "حذف"}
          </Button>
        )}
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
