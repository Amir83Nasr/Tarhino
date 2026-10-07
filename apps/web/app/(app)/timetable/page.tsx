"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"

import { downloadTimetablePdf } from "@/features/reports/api"
import { PdfButton } from "@/features/reports/pdf-button"
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

  const allPeriods = usePeriodsByClass(classId)
  // Timetable grid shows this week's bell set only.
  const periods = allPeriods?.filter(
    (p) => !single || p.shift === single.active_shift
  )
  const { data: slots } = useWeeklySlots(classId)
  const subjects = useTimetableSubjects(classId)

  const exportDisabled = !classId || slots === undefined

  // Class timetable, one A4 page. Excel lives in the reports center.
  async function downloadPdf() {
    if (!classId) throw new Error("no class")
    await downloadTimetablePdf(classId)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-lg">برنامه هفتگی</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <CardTitle className="me-auto">جدول کلاس</CardTitle>
          <PdfButton
            label="دریافت PDF"
            disabled={exportDisabled}
            run={downloadPdf}
          />
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
