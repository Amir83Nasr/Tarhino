"use client"

import { FileDown } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
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
import { toast } from "@workspace/ui/components/sonner"
import { ResponsiveDialog } from "@workspace/ui/components/responsive-dialog"

import { useStudents } from "@/features/grades/hooks"
import { studentDisplayName } from "@/features/teaching/api"
import {
  downloadClassReportCardsPdf,
  downloadStudentReportCardPdf,
} from "@/features/reports/api"

function fail() {
  toast.error("دانلود انجام نشد")
}

// Per-student report card downloads for one class: pick one student for a
// single card, or take the whole class as one multi-page PDF.
export function ReportCardsSection({ classId }: { classId: string }) {
  const students = useStudents(classId)
  const [studentId, setStudentId] = useState("")
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<"one" | "all" | null>(null)

  // The picker lives in the dialog so the card stays compact; state survives
  // close, matching the grades flow where picking is the whole step.
  async function downloadOne() {
    if (!studentId) {
      toast.error("دانش‌آموز را انتخاب کنید")
      return
    }
    setBusy("one")
    try {
      await downloadStudentReportCardPdf(classId, studentId)
      toast.success("فایل پی‌دی‌اف ذخیره شد")
      setOpen(false)
    } catch {
      fail()
    } finally {
      setBusy(null)
    }
  }

  async function downloadAll() {
    setBusy("all")
    try {
      await downloadClassReportCardsPdf(classId)
      toast.success("فایل پی‌دی‌اف ذخیره شد")
    } catch {
      fail()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle className="me-auto">کارنامه دانش‌آموز</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            busy === "all" || students === undefined || !students.length
          }
          onClick={() => void downloadAll()}
          title="کارنامه همه دانش‌آموزان در یک فایل"
        >
          <FileDown />
          {busy === "all" ? "…" : "همه (پی‌دی‌اف)"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={students === undefined || !students.length}
          onClick={() => setOpen(true)}
        >
          تک‌نفره (پی‌دی‌اف)
        </Button>
      </CardHeader>
      <CardContent>
        {students === undefined ? (
          <Skeleton className="h-9 w-full" />
        ) : students.length === 0 ? (
          <p className="rounded-lg border border-dashed border-foreground/10 py-3 text-center text-xs text-muted-foreground">
            اول از بخش دانش‌آموزان شاگرد اضافه کنید.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            هر کارنامه میانگین هر درس و معدل کل را نشان می‌دهد.
          </p>
        )}
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
          <Button
            type="button"
            size="default"
            disabled={busy === "one" || !studentId}
            onClick={() => void downloadOne()}
          >
            <FileDown />
            {busy === "one" ? "…" : "دانلود کارنامه (پی‌دی‌اف)"}
          </Button>
        </div>
      </ResponsiveDialog>
    </Card>
  )
}
