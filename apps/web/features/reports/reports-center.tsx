"use client"

import { useState } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { JalaliDatePicker } from "@/components/jalali-date-picker"
import { toast } from "@workspace/ui/components/sonner"
import { exportLessonPlans } from "@/features/excel/import-export"
import { useClasses } from "@/features/teaching/hooks"
import {
  downloadAttendancePdf,
  downloadSchedulePdf,
  downloadStudentListPdf,
  downloadTimetablePdf,
  downloadTimetableXls,
} from "@/features/reports/api"
import { PdfButton } from "@/features/reports/pdf-button"
import { toISODate, today, weekDays } from "@/lib/date/jalali"

// Reports center: every teacher PDF in one place, A4, ready to share.
// Grade PDFs join here in stage 4 (ponytail).
export function ReportsCenter() {
  const classes = useClasses()
  const classId = classes?.[0]?.id ?? null
  const [day, setDay] = useState(() => new Date())
  const [excelBusy, setExcelBusy] = useState(false)
  const days = weekDays(day)
  const from = toISODate(days[0] ?? day)
  const to = toISODate(days[6] ?? day)
  const off = !classId || classes === undefined

  async function weekPdf() {
    if (!classId) throw new Error("no class")
    await downloadSchedulePdf(from, to, classId)
  }
  async function timetablePdf() {
    if (!classId) throw new Error("no class")
    await downloadTimetablePdf(classId)
  }
  async function studentsPdf() {
    if (!classId) throw new Error("no class")
    await downloadStudentListPdf(classId)
  }
  async function attendancePdf() {
    if (!classId) throw new Error("no class")
    await downloadAttendancePdf(classId, toISODate(today()))
  }
  async function weekExcel() {
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
  async function timetableExcel() {
    if (!classId) throw new Error("no class")
    await downloadTimetableXls(classId)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>گزارش‌ها</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <JalaliDatePicker
          value={toISODate(day)}
          onChange={(iso) => {
            if (!iso) return
            const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number)
            setDay(new Date(y, m - 1, d))
          }}
          ariaLabel="هفته گزارش"
        />
        <div className="flex flex-wrap gap-2">
          <PdfButton label="طرح درس هفته" disabled={off} run={weekPdf} />
          <PdfButton label="برنامه هفتگی" disabled={off} run={timetablePdf} />
          <PdfButton
            label="فهرست دانش‌آموزان"
            disabled={off}
            run={studentsPdf}
          />
          <PdfButton
            label="برگ حضور امروز"
            disabled={off}
            run={attendancePdf}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <PdfButton
            label="اکسل هفته"
            disabled={excelBusy}
            run={weekExcel}
            done="فایل اکسل ذخیره شد"
          />
          <PdfButton
            label="اکسل برنامه"
            disabled={off}
            run={timetableExcel}
            done="فایل اکسل ذخیره شد"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          همه A4، آماده چاپ و اشتراک.
        </p>
      </CardContent>
    </Card>
  )
}
