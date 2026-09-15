"use client"

import { FileDown, FileSpreadsheet, FileText } from "lucide-react"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { toast } from "@workspace/ui/components/sonner"

import {
  downloadTimetablePdf,
  downloadTimetableXls,
} from "@/features/reports/api"
import {
  usePeriodsByClass,
  useTimetableSubjects,
  useWeeklySlots,
} from "@/features/timetable/hooks"
import {
  TimetableGrid,
  TimetableSkeleton,
} from "@/features/timetable/timetable-grid"
import { useClasses } from "@/features/teaching/hooks"
import { SHIFT_LABEL } from "@/features/settings/elementary-presets"

export default function TimetablePage() {
  const classes = useClasses()
  const single = classes?.[0] ?? null
  const classId = single?.id ?? null
  const [exportBusy, setExportBusy] = useState<"pdf" | "xls" | null>(null)

  const allPeriods = usePeriodsByClass(classId)
  // Timetable grid shows this week's bell set only.
  const periods = allPeriods?.filter(
    (p) => !single || p.shift === single.active_shift
  )
  const { data: slots } = useWeeklySlots(classId)
  const subjects = useTimetableSubjects(classId)

  const exportDisabled = !classId || exportBusy !== null || slots === undefined

  async function downloadPdf() {
    if (!classId) return
    setExportBusy("pdf")
    try {
      await downloadTimetablePdf(classId)
      toast.success("فایل پی‌دی‌اف ذخیره شد")
    } catch {
      toast.error("دانلود انجام نشد")
    } finally {
      setExportBusy(null)
    }
  }

  async function downloadXls() {
    if (!classId) return
    setExportBusy("xls")
    try {
      await downloadTimetableXls(classId)
      toast.success("فایل اکسل ذخیره شد")
    } catch {
      toast.error("دانلود انجام نشد")
    } finally {
      setExportBusy(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-lg">برنامه هفتگی</h1>
        <p className="text-sm text-muted-foreground">
          یک‌بار بچین، کل سال همان می‌ماند. طرح درس هر هفته خودکار از همین قالب
          ساخته می‌شود.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <CardTitle className="me-auto">جدول کلاس</CardTitle>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportDisabled}
                  title="خروجی جدول همین کلاس"
                />
              }
            >
              <FileDown />
              {exportBusy === "pdf"
                ? "در حال ساخت پی‌دی‌اف…"
                : exportBusy === "xls"
                  ? "در حال ساخت اکسل…"
                  : "خروجی جدول"}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1.5">
              <Button
                variant="ghost"
                className="w-full justify-start"
                disabled={exportDisabled}
                onClick={() => void downloadPdf()}
              >
                <FileText />
                خروجی پی‌دی‌اف
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                disabled={exportDisabled}
                onClick={() => void downloadXls()}
              >
                <FileSpreadsheet />
                خروجی اکسل
              </Button>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {classes === undefined ? (
            <TimetableSkeleton />
          ) : !single ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-foreground/10 py-10 text-center">
              <p className="text-sm font-medium">هنوز کلاسی ساخته نشده</p>
              <p className="text-xs text-muted-foreground">
                اول از تنظیمات کلاس را بسازید.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-sm text-muted-foreground">
                  {single.name}
                </Label>
                <Badge variant="secondary">
                  {single.shift === "rotating"
                    ? `این هفته: ${SHIFT_LABEL[single.active_shift]}`
                    : `شیفت ${SHIFT_LABEL[single.shift]}`}
                </Badge>
              </div>
              {classId ? (
                <TimetableGrid
                  classId={classId}
                  periods={periods}
                  slots={slots}
                  subjects={subjects}
                />
              ) : (
                <TimetableSkeleton />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
