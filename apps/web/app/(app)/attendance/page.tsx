"use client"

import { Check, ChevronLeft, ChevronRight, X } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { JalaliDatePicker } from "@/components/jalali-date-picker"
import { PdfButton } from "@/features/reports/pdf-button"
import { downloadAttendancePdf } from "@/features/reports/api"
import {
  useAttendanceDay,
  useAttendanceSummary,
  useSetAttendanceDay,
} from "@/features/attendance/hooks"
import { useStudents } from "@/features/grades/hooks"
import { studentDisplayName } from "@/features/teaching/api"
import { useClasses } from "@/features/teaching/hooks"
import { ApiError } from "@/lib/api/client"
import {
  addDays,
  formatFullDate,
  formatNumericDate,
  isSchoolWeekend,
  today,
  toISODate,
  toPersianDigits,
} from "@/lib/date/jalali"

// Daily roll call: the whole class starts present, the teacher taps the
// absent ones, one save writes the day. Empty day = all present.
export default function AttendancePage() {
  const classes = useClasses()
  const singleClassId = classes?.[0]?.id ?? null
  const [day, setDay] = useState(() => today())
  const iso = toISODate(day)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-lg">حضور و غیاب</h1>
      </div>

      {classes === undefined ? (
        <Skeleton className="h-10 w-full" />
      ) : !singleClassId ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            اول از تنظیمات کلاس بسازید.
          </CardContent>
        </Card>
      ) : (
        <>
          <DayPicker day={day} onChange={setDay} />
          <RollCall
            key={`${singleClassId}:${iso}`}
            classId={singleClassId}
            iso={iso}
          />
          <AbsenceSummary classId={singleClassId} />
        </>
      )}
    </div>
  )
}

function DayPicker({
  day,
  onChange,
}: {
  day: Date
  onChange: (day: Date) => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 py-4">
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label="روز قبل"
          onClick={() => onChange(addDays(day, -1))}
        >
          <ChevronRight />
        </Button>
        <JalaliDatePicker
          value={toISODate(day)}
          onChange={(iso) => {
            if (!iso) return
            const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number)
            onChange(new Date(y, m - 1, d))
          }}
          ariaLabel="تاریخ حضور و غیاب"
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label="روز بعد"
          onClick={() => onChange(addDays(day, 1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onChange(today())}
        >
          امروز
        </Button>
        <span className="text-xs text-muted-foreground">
          {formatNumericDate(day)}
          {isSchoolWeekend(day) ? " · پنج‌شنبه/جمعه تعطیل است" : ""}
        </span>
      </CardContent>
    </Card>
  )
}

function RollCall({ classId, iso }: { classId: string; iso: string }) {
  const students = useStudents(classId)
  const saved = useAttendanceDay(classId, iso)
  const save = useSetAttendanceDay(classId, iso)
  const [absent, setAbsent] = useState<Set<string> | null>(null)

  const savedAbsent = useMemo(
    () =>
      new Set(
        (saved ?? [])
          .filter((r) => r.status === "absent")
          .map((r) => r.student_id)
      ),
    [saved]
  )
  const current = absent ?? savedAbsent

  function toggle(id: string) {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setAbsent(next)
  }

  function markAll(present: boolean) {
    if (!students) return
    setAbsent(present ? new Set() : new Set(students.map((s) => s.id)))
  }

  function submit() {
    save.mutate([...current], {
      onSuccess: (rows) => {
        setAbsent(
          new Set(
            rows.filter((r) => r.status === "absent").map((r) => r.student_id)
          )
        )
        toast.success("حضور و غیاب ذخیره شد")
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : "ذخیره نشد")
      },
    })
  }

  if (students === undefined || saved === undefined) {
    return <Skeleton className="h-64 w-full" />
  }
  if (!students.length) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          هنوز دانش‌آموزی نیست؛ از بخش کارنامه شاگرد اضافه کنید.
        </CardContent>
      </Card>
    )
  }

  const dirty =
    absent !== null &&
    (absent.size !== savedAbsent.size ||
      [...absent].some((id) => !savedAbsent.has(id)))
  const absentCount = current.size

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <CardTitle className="me-auto">
          {formatFullDate(new Date(`${iso}T12:00:00`))}
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {toPersianDigits(absentCount)} غایب از{" "}
          {toPersianDigits(students.length)}
        </span>
        <PdfButton
          label="دریافت PDF"
          run={() => downloadAttendancePdf(classId, iso)}
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => markAll(true)}
        >
          همه حاضر
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => markAll(false)}
        >
          همه غایب
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="flex flex-col gap-2">
          {students.map((student, i) => {
            const isAbsent = current.has(student.id)
            return (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => toggle(student.id)}
                  aria-pressed={isAbsent}
                  aria-label={`${studentDisplayName(student)}: ${isAbsent ? "غایب" : "حاضر"}`}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm transition-colors",
                    isAbsent
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-foreground/10 bg-background hover:bg-muted/50"
                  )}
                >
                  <span className="w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                    {toPersianDigits(i + 1)}
                  </span>
                  <span className="flex-1">{studentDisplayName(student)}</span>
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                      isAbsent
                        ? "bg-destructive/10 text-destructive"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    {isAbsent ? (
                      <X className="size-3.5" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    {isAbsent ? "غایب" : "حاضر"}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <Button
          type="button"
          disabled={save.isPending || !dirty}
          onClick={submit}
          className="w-full"
        >
          {save.isPending ? "…" : dirty ? "ذخیره حضور و غیاب" : "ذخیره شد"}
        </Button>
      </CardContent>
    </Card>
  )
}

function AbsenceSummary({ classId }: { classId: string }) {
  const summary = useAttendanceSummary(classId)
  const students = useStudents(classId)

  if (summary === undefined || students === undefined) {
    return <Skeleton className="h-24 w-full" />
  }
  const entries = Object.entries(summary)
    .map(([id, count]) => {
      const student = students.find((s) => s.id === id)
      return { id, name: student ? studentDisplayName(student) : "—", count }
    })
    .sort((a, b) => b.count - a.count)
  if (!entries.length) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle className="me-auto">جمع غیبت‌ها</CardTitle>
        <PdfButton
          label="دریافت PDF"
          run={() => downloadAttendancePdf(classId, toISODate(today()))}
        />
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1.5 text-sm">
          {entries.map(({ id, name, count }) => (
            <li
              key={id}
              className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5"
            >
              <span>{name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {toPersianDigits(count)} جلسه
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
