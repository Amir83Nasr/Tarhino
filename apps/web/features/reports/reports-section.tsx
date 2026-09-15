"use client"

import { useState } from "react"

import { FileText } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { toast } from "@workspace/ui/components/sonner"

import { useClasses } from "@/features/teaching/hooks"
import { downloadStudentListPdf } from "@/features/reports/api"

// Single class: the student-list PDF targets it directly, no picker.
export function ReportsSection() {
  const classes = useClasses()
  const singleClassId = classes?.[0]?.id ?? ""
  const [busy, setBusy] = useState(false)

  async function download() {
    if (!singleClassId) {
      toast.error("اول از تنظیمات کلاس بسازید")
      return
    }
    setBusy(true)
    try {
      await downloadStudentListPdf(singleClassId)
      toast.success("فایل پی‌دی‌اف ذخیره شد")
    } catch {
      toast.error("دانلود انجام نشد")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>گزارش‌ها</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !singleClassId || classes === undefined}
          onClick={() => void download()}
        >
          <FileText />
          فهرست دانش‌آموزان (پی‌دی‌اف)
        </Button>
      </CardContent>
    </Card>
  )
}
