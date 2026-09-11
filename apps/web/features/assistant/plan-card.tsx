"use client"

import { CalendarCheck } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
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

import { JalaliDatePicker } from "@/components/jalali-date-picker"
import { TimeInput } from "@/components/time-input"
import { ApiError, apiFetch } from "@/lib/api/client"
import type { LessonPlan } from "@/lib/api/types"
import { formatNumericDate, fromISODate, parseJalali } from "@/lib/date/jalali"
import {
  appendPlansToCache,
  useLookups,
  type LessonPlanInput,
} from "@/features/teaching/hooks"
import { useQueryClient } from "@tanstack/react-query"
import { resolvePlanDraft, type PlanDraft } from "@/features/assistant/ai"

// The model proposes, the teacher disposes: every ```plan block lands in a
// familiar, editable card. Multi-day proposals batch-save through the normal
// bulk endpoint; the server validates each row and reports per-row results.

export function PlanCards({
  drafts,
  onDone,
}: {
  drafts: PlanDraft[]
  onDone: () => void
}) {
  if (drafts.length === 1) {
    const only = drafts[0]
    if (!only) return null
    return <PlanCard draft={only} onSaved={onDone} single />
  }
  return <PlanBatch drafts={drafts} onDone={onDone} />
}

function PlanBatch({
  drafts,
  onDone,
}: {
  drafts: PlanDraft[]
  onDone: () => void
}) {
  const { classes, subjects, periods } = useLookups()
  const client = useQueryClient()

  const [rows, setRows] = useState(() =>
    drafts.map((draft, index) => ({
      key: `${index}`,
      selected: true,
      values: resolvePlanDraft(
        draft,
        { classes, subjects, periods },
        parseJalali
      ),
    }))
  )
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [savedCount, setSavedCount] = useState(0)

  const lookupsReady = classes.length + subjects.length + periods.length > 0

  function patch(
    key: string,
    field: "isoDate" | "activity" | "notes",
    value: string | null
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? { ...row, values: { ...row.values, [field]: value } }
          : row
      )
    )
  }

  function toggle(key: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, selected: !row.selected } : row
      )
    )
  }

  async function saveAll() {
    const chosen = rows.filter((row) => row.selected && !(row.key in failed))
    if (!chosen.length) {
      toast.error("موردی برای ثبت انتخاب نشده است")
      return
    }
    for (const row of chosen) {
      if (!row.values.isoDate) {
        toast.error("تاریخ یکی از موارد معتبر نیست")
        return
      }
      if (!row.values.activity.trim()) {
        toast.error("شرح فعالیت یکی از موارد خالی است")
        return
      }
    }
    setBusy(true)
    try {
      const items: LessonPlanInput[] = chosen.map((row) => ({
        date: row.values.isoDate as string,
        activity: row.values.activity.trim(),
        class_id: row.values.classId || null,
        subject_id: row.values.subjectId || null,
        period_id: row.values.periodId || null,
        start_time: row.values.startTime || null,
        end_time: row.values.endTime || null,
        status: "planned",
        notes: row.values.notes.trim(),
      }))
      const result = await apiFetch<{
        created: LessonPlan[]
        errors: { index: number; detail: string }[]
      }>("/lesson-plans/bulk", { method: "POST", body: { items } })
      const nextFailed: Record<string, string> = {}
      for (const error of result.errors) {
        const key = chosen[error.index]?.key
        if (key) nextFailed[key] = error.detail
      }
      const failedKeys = new Set(Object.keys(nextFailed))
      const savedKeys = chosen
        .map((row) => row.key)
        .filter((key) => !failedKeys.has(key))
      setFailed((prev) => {
        const next = { ...prev }
        for (const key of savedKeys) delete next[key]
        return { ...next, ...nextFailed }
      })
      setSavedCount((n) => n + result.created.length)
      // Created rows land in the cache; the failed keys stay for retry, so no
      // full list refetch on either path.
      appendPlansToCache(client, result.created)
      if (result.errors.length === 0) {
        toast.success(`${result.created.length} مورد در برنامه ثبت شد`)
        onDone()
      } else {
        toast.error(
          `${result.created.length} ثبت شد، ${result.errors.length} ناموفق بود`
        )
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره نشد")
    } finally {
      setBusy(false)
    }
  }

  const selectedCount = rows.filter(
    (row) => row.selected && !(row.key in failed)
  ).length

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg bg-muted px-3 py-2">
      <p className="text-xs font-medium">
        {drafts.length} پیشنهاد برای ثبت در برنامه
        {savedCount > 0 && ` — ${savedCount} ثبت شد`}
      </p>
      {!lookupsReady && (
        <p className="text-xs text-muted-foreground">در حال بارگذاری…</p>
      )}
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const reason = failed[row.key]
          const isFailed = reason !== undefined
          const label = row.values.isoDate
            ? formatNumericDate(fromISODate(row.values.isoDate))
            : "تاریخ نامعتبر"
          return (
            <li
              key={row.key}
              className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={row.selected && !isFailed}
                disabled={isFailed}
                onChange={() => toggle(row.key)}
                aria-label={`انتخاب ${label}`}
                className="size-4 accent-primary"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {row.values.activity || "بدون شرح"}
                </p>
                <p className="text-xs text-muted-foreground">{label}</p>
                {isFailed && (
                  <p className="text-xs text-destructive">{reason}</p>
                )}
              </div>
              <Input
                value={row.values.activity}
                onChange={(e) => patch(row.key, "activity", e.target.value)}
                aria-label="شرح فعالیت"
                className="h-8 max-w-32 text-xs"
              />
            </li>
          )
        })}
      </ul>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={saveAll}
          disabled={busy || selectedCount === 0}
        >
          <CalendarCheck />
          {busy ? "در حال ثبت…" : `ثبت ${selectedCount} مورد`}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          بستن
        </Button>
      </div>
    </div>
  )
}

export function PlanCard({
  draft,
  onSaved,
  single = false,
}: {
  draft: PlanDraft
  onSaved: () => void
  single?: boolean
}) {
  const { classes, subjects, periods } = useLookups()

  const [resolved] = useState(() =>
    resolvePlanDraft(draft, { classes, subjects, periods }, parseJalali)
  )

  const [date, setDate] = useState(resolved.isoDate)
  const [activity, setActivity] = useState(resolved.activity)
  const [classId, setClassId] = useState(resolved.classId)
  const [subjectId, setSubjectId] = useState(resolved.subjectId)
  const [periodId, setPeriodId] = useState(resolved.periodId)
  const [startTime, setStartTime] = useState(resolved.startTime)
  const [endTime, setEndTime] = useState(resolved.endTime)
  const [notes, setNotes] = useState(resolved.notes)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const client = useQueryClient()

  const classItems = [
    { label: "—", value: null as string | null },
    ...classes.map((c) => ({ label: c.name, value: c.id as string | null })),
  ]
  const subjectItems = [
    { label: "—", value: null as string | null },
    ...subjects.map((s) => ({ label: s.name, value: s.id as string | null })),
  ]
  const periodItems = [
    { label: "—", value: null as string | null },
    ...periods.map((p) => ({ label: p.label, value: p.id as string | null })),
  ]

  function pickPeriod(id: string) {
    setPeriodId(id)
    const chosen = periods.find((p) => p.id === id)
    if (chosen && !startTime && !endTime) {
      setStartTime(chosen.start_time.slice(0, 5))
      setEndTime(chosen.end_time.slice(0, 5))
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!date) {
      toast.error("تاریخ معتبر نیست؛ دوباره انتخاب کنید")
      return
    }
    if (!activity.trim()) {
      toast.error("شرح فعالیت را وارد کنید")
      return
    }
    setBusy(true)
    try {
      const saved = await apiFetch<LessonPlan>("/lesson-plans", {
        method: "POST",
        body: {
          date,
          activity: activity.trim(),
          class_id: classId || null,
          subject_id: subjectId || null,
          period_id: periodId || null,
          start_time: startTime || null,
          end_time: endTime || null,
          status: "planned",
          notes: notes.trim(),
        },
      })
      appendPlansToCache(client, [saved])
      setDone(true)
      if (!single) onSaved()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره نشد")
    } finally {
      setBusy(false)
    }
  }

  if (done && single)
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
        <CalendarCheck className="size-4 text-primary" />
        در برنامه ثبت شد
        {date && ` — ${formatNumericDate(fromISODate(date))}`}.
        <button
          type="button"
          className="ms-auto text-primary underline underline-offset-4"
          onClick={onSaved}
        >
          بستن
        </button>
      </div>
    )

  if (done) return null

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-2 rounded-lg bg-muted px-3 py-2"
    >
      <p className="text-xs font-medium">پیشنهاد ثبت در برنامه</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-activity">فعالیت</Label>
        <Input
          id="plan-activity"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>تاریخ</Label>
          <JalaliDatePicker value={date} onChange={setDate} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>زنگ</Label>
          <Select
            items={periodItems}
            value={periodId || null}
            onValueChange={(value) => pickPeriod(value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectLabel>زنگ‌ها</SelectLabel>
                {periodItems.map((item) => (
                  <SelectItem key={item.value ?? ""} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>کلاس</Label>
          <Select
            items={classItems}
            value={classId || null}
            onValueChange={(value) => setClassId(value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectLabel>کلاس‌ها</SelectLabel>
                {classItems.map((item) => (
                  <SelectItem key={item.value ?? ""} value={item.value}>
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
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectLabel>درس‌ها</SelectLabel>
                {subjectItems.map((item) => (
                  <SelectItem key={item.value ?? ""} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-start">شروع</Label>
          <TimeInput
            id="plan-start"
            value={startTime}
            onChange={setStartTime}
            aria-label="ساعت شروع"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-end">پایان</Label>
          <TimeInput
            id="plan-end"
            value={endTime}
            onChange={setEndTime}
            aria-label="ساعت پایان"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-notes">یادداشت</Label>
        <Input
          id="plan-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        <CalendarCheck />
        {busy ? "در حال ثبت…" : "ثبت در برنامه"}
      </Button>
    </form>
  )
}
