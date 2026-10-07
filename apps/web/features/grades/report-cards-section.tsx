"use client"

import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { PdfButton } from "@/features/reports/pdf-button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { ResponsiveDialog } from "@workspace/ui/components/responsive-dialog"

import { useStudents } from "@/features/grades/hooks"
import { studentDisplayName } from "@/features/teaching/api"
import {
  downloadClassReportCardsPdf,
  downloadStudentReportCardPdf,
} from "@/features/reports/api"

export function ReportCardsSection({ classId }: { classId: string }) {
  const students = useStudents(classId)
  const [studentId, setStudentId] = useState("")
  const [open, setOpen] = useState(false)

  // The picker lives in the dialog so the card stays compact; state survives
  // close, matching the grades flow where picking is the whole step.
  async function downloadOne() {
    if (!studentId) throw new Error("no student")
    await downloadStudentReportCardPdf(classId, studentId)
    setOpen(false)
  }

  async function downloadAll() {
    await downloadClassReportCardsPdf(classId)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle className="me-auto">کارنامه دانش‌آموز</CardTitle>
        <PdfButton
          label="همه"
          disabled={students === undefined || !students.length}
          run={downloadAll}
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={students === undefined || !students.length}
          onClick={() => setOpen(true)}
        >
          تک‌نفره
        </Button>
      </CardHeader>
      <CardContent>
        {students === undefined ? (
          <Skeleton className="h-9 w-full" />
        ) : students.length === 0 ? (
          <p className="rounded-lg border border-dashed border-foreground/10 py-3 text-center text-xs text-muted-foreground">
            اول از بخش دانش‌آموزان شاگرد اضافه کنید.
          </p>
        ) : null}
      </CardContent>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="کارنامه تک‌نفره"
        description="یک دانش‌آموز انتخاب کنید."
      >
        <div className="flex flex-col gap-3">
          <Select
            items={(students ?? []).map((s) => ({
              label: studentDisplayName(s),
              value: s.id,
            }))}
            value={studentId || null}
            onValueChange={(v) => setStudentId(v ?? "")}
          >
            <SelectTrigger className="w-full" aria-label="دانش‌آموز">
              <SelectValue placeholder="دانش‌آموز…" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectLabel>دانش‌آموزان</SelectLabel>
                {(students ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {studentDisplayName(s)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <PdfButton
            label="دریافت PDF"
            disabled={!studentId}
            run={downloadOne}
          />
        </div>
      </ResponsiveDialog>
    </Card>
  )
}
