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

import { useClasses } from "@/features/teaching/hooks"
import { downloadStudentListPdf } from "@/features/reports/api"

export function ReportsSection() {
  const classes = useClasses()
  const [classId, setClassId] = useState("")
  const [busy, setBusy] = useState(false)

  async function download() {
    if (!classId) {
      toast.error("کلاس را انتخاب کنید")
      return
    }
    setBusy(true)
    try {
      await downloadStudentListPdf(classId)
      toast.success("فایل PDF ذخیره شد")
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
        <Select
          items={(classes ?? []).map((c) => ({ label: c.name, value: c.id }))}
          value={classId || null}
          onValueChange={(v) => setClassId(v ?? "")}
        >
          <SelectTrigger className="w-full" aria-label="کلاس">
            <SelectValue placeholder="کلاس…" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              <SelectLabel>کلاس‌ها</SelectLabel>
              {(classes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !classId}
          onClick={() => void download()}
        >
          <FileText />
          فهرست دانش‌آموزان (PDF)
        </Button>
      </CardContent>
    </Card>
  )
}
