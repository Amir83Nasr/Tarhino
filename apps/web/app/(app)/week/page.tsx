"use client"

import {
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { ResponsiveDialog } from "@workspace/ui/components/responsive-dialog"

import { useQueryClient } from "@tanstack/react-query"

// The dialog (form + Jalali picker + selects) loads on first open, not with
// the page: week renders and navigates without carrying its weight.
const LessonDialog = dynamic(
  () => import("@/features/teaching/lesson-dialog").then((m) => m.LessonDialog),
  { ssr: false }
)
import { downloadSchedulePdf } from "@/features/reports/api"
import { exportLessonPlans } from "@/features/excel/import-export"
import {
  LessonTable,
  LessonTableSkeleton,
  sortPlansByPeriod,
} from "@/features/teaching/lesson-table"
import { toast } from "@workspace/ui/components/sonner"
import {
  prefetchWeek,
  useHolidays,
  useLessonPlans,
  useLookups,
} from "@/features/teaching/hooks"
import { useEnsureWeek } from "@/features/timetable/hooks"
import {
  addDays,
  formatShortDate,
  isSameDay,
  isSchoolWeekend,
  monthName,
  startOfWeek,
  today,
  toISODate,
  toJalali,
  toPersianDigits,
  weekDays,
  weekdayName,
} from "@/lib/date/jalali"
import type { LessonPlan } from "@/lib/api/types"

export default function WeekPage() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  const [editing, setEditing] = useState<LessonPlan | null>(null)
  const [open, setOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [serverPdfBusy, setServerPdfBusy] = useState(false)
  const [excelBusy, setExcelBusy] = useState(false)

  // Single class: exports target it directly, no picker.
  const { classes } = useLookups()
  const singleClassId = classes?.[0]?.id ?? null

  const days = weekDays(anchor)
  const from = toISODate(days[0] ?? anchor)
  const to = toISODate(days[6] ?? anchor)
  const selectedIso = toISODate(selected)

  // Server PDF: the whole visible week, one A4 page, class header included.
  async function serverWeekPdf() {
    if (!singleClassId) {
      toast.error("اول از تنظیمات کلاس بسازید")
      return
    }
    setServerPdfBusy(true)
    try {
      await downloadSchedulePdf(from, to, singleClassId)
      toast.success("فایل پی‌دی‌اف ذخیره شد")
    } catch {
      toast.error("دانلود انجام نشد")
    } finally {
      setServerPdfBusy(false)
    }
  }

  // Client Excel: the whole visible week, all classes, Jalali dates.
  async function exportWeekExcel() {
    setExcelBusy(true)
    try {
      await exportLessonPlans(from, to)
      toast.success("فایل اکسل ذخیره شد")
    } catch {
      toast.error("دانلود انجام نشد")
    } finally {
      setExcelBusy(false)
    }
  }

  function select(plan: LessonPlan) {
    setEditing(plan)
    setOpen(true)
  }

  const plans = useLessonPlans(from, to)
  const holidays = useHolidays(from, to)
  const { periods } = useLookups()
  const ensureWeek = useEnsureWeek()
  // The template sits on every week by itself: visiting a week fills its
  // rows once, no teacher tap needed. The range key keeps day taps and
  // tab-hops from re-firing it.
  const ensuredKey = singleClassId ? `${singleClassId}:${from}` : null
  useEffect(() => {
    if (!ensuredKey || !singleClassId) return
    ensureWeek.mutate({ classId: singleClassId, weekStart: from })
    // Fire once per week: the mutation result (not the flag) drives retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensuredKey])
  // Day list reads bell-first: table rows share one order.
  const selectedPlans = useMemo(() => {
    const filtered = (plans ?? []).filter((p) => p.date === selectedIso)
    return sortPlansByPeriod(filtered, periods)
  }, [plans, selectedIso, periods])
  const selectedHoliday = holidays?.find((h) => h.date === selectedIso)

  // Nights and weekends are free: warm the adjacent weeks so shifting feels
  // instant instead of fetching on click.
  const client = useQueryClient()
  useEffect(() => {
    const prev = addDays(anchor, -7)
    const next = addDays(anchor, 7)
    prefetchWeek(
      client,
      toISODate(startOfWeek(prev)),
      toISODate(addDays(startOfWeek(prev), 6))
    )
    prefetchWeek(
      client,
      toISODate(startOfWeek(next)),
      toISODate(addDays(startOfWeek(next), 6))
    )
  }, [anchor, client])

  const weekStart = toJalali(startOfWeek(anchor))

  function shiftWeek(delta: number) {
    const next = addDays(anchor, delta * 7)
    setAnchor(next)
    setSelected(startOfWeek(next))
  }

  const todayIso = toISODate(today())
  const isTodaySelected = selectedIso === todayIso

  function goToday() {
    const now = today()
    setAnchor(now)
    setSelected(now)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg">طرح درس</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={goToday}
          disabled={isTodaySelected}
          title="برگشت به طرح درس امروز"
        >
          <CalendarDays />
          بازگشت به امروز
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <header className="mx-auto flex w-full max-w-lg items-center justify-between">
            <Button size="sm" variant="ghost" onClick={() => shiftWeek(-1)}>
              <ChevronRight />
              هفته قبل
            </Button>
            <span className="text-sm font-medium">
              {monthName(weekStart.month)} {toPersianDigits(weekStart.year)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => shiftWeek(1)}>
              هفته بعد
              <ChevronLeft />
            </Button>
          </header>

          <ul className="mx-auto grid w-full max-w-md grid-cols-7 gap-1">
            {days.map((day) => {
              const active = isSameDay(day, selected)
              const off = isSchoolWeekend(day)
              const isToday = toISODate(day) === todayIso
              return (
                <li key={day.toISOString()}>
                  <button
                    type="button"
                    onClick={() => setSelected(day)}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`انتخاب روز ${formatShortDate(day)}`}
                    className={cn(
                      "flex w-full flex-col items-center gap-1 rounded-lg py-2 text-xs",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                      !active && isToday && "ring-1 ring-primary ring-inset"
                    )}
                  >
                    <span>{weekdayName(day).slice(0, 1)}</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        !active && off && "text-destructive"
                      )}
                    >
                      {toPersianDigits(toJalali(day).day)}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "size-1 rounded-full",
                        isToday && !active && "bg-primary"
                      )}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <CardTitle className="me-auto">
            درس‌های {formatShortDate(selected)}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPdfOpen(true)}
            disabled={plans === undefined}
            title="خروجی گرفتن از جدول طرح درس هفته"
          >
            <FileDown />
            خروجی گرفتن از جدول
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {selectedHoliday && (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {selectedHoliday.title} — تعطیل
            </div>
          )}

          {plans === undefined ? (
            <LessonTableSkeleton rows={1} />
          ) : selectedPlans.length ? (
            <LessonTable plans={selectedPlans} onSelect={select} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-foreground/10 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CalendarOff className="size-6" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">این روز خالی است</p>
                <p className="text-xs text-muted-foreground">
                  برای این روز درسی ثبت نشده.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        title="خروجی گرفتن از جدول"
        description="کل هفته را پی‌دی‌اف یا اکسل ذخیره کن."
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            disabled={serverPdfBusy || !singleClassId}
            onClick={() => void serverWeekPdf()}
          >
            <FileDown />
            {serverPdfBusy ? "در حال ساخت…" : "ذخیره کل هفته پی‌دی‌اف"}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            disabled={excelBusy}
            onClick={() => void exportWeekExcel()}
          >
            <FileSpreadsheet />
            {excelBusy ? "در حال ساخت…" : "ذخیره کل هفته اکسل"}
          </Button>
        </div>
      </ResponsiveDialog>

      <LessonDialog
        open={open}
        onOpenChange={setOpen}
        date={selectedIso}
        plan={editing}
      />
    </div>
  )
}
