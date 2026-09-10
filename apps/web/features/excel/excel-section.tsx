"use client"

import { Download, Upload } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import {
  commitImport,
  exportLessonPlans,
  parseImport,
  type ImportPreview,
} from "@/features/excel/import-export"
import { useLookups } from "@/features/teaching/hooks"
import { formatShortDate, fromISODate, parseJalali } from "@/lib/date/jalali"

// Export a Jalali range, or import a file back. Import is preview-first: parse()
// validates, the list below shows what would land, and only "ثبت" writes.

// ── SHARED ─────────────────────────────────────────────────

function fail(error: unknown) {
  toast.error(error instanceof Error ? error.message : "انجام نشد")
}

// ── EXPORT ─────────────────────────────────────────────────

function ExportCard() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [busy, setBusy] = useState(false)

  async function run() {
    const start = parseJalali(from)
    const end = parseJalali(to)
    if (!start || !end) {
      toast.error("تاریخ‌ها را مانند ۱۴۰۴/۰۳/۱۵ بنویسید")
      return
    }
    if (end < start) {
      toast.error("تاریخ پایان باید بعد از شروع باشد")
      return
    }

    setBusy(true)
    try {
      const count = await exportLessonPlans(start, end)
      if (count) toast.success(`${count} طرح ذخیره شد`)
      else toast.info("در این بازه طرحی نیست")
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>خروجی اکسل</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="از ۱۴۰۴/۰۳/۰۱"
            inputMode="numeric"
            aria-label="از تاریخ"
          />
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="تا ۱۴۰۴/۰۳/۳۱"
            inputMode="numeric"
            aria-label="تا تاریخ"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void run()}
        >
          <Download />
          دریافت فایل
        </Button>
      </CardContent>
    </Card>
  )
}

// ── IMPORT ─────────────────────────────────────────────────

function ImportCard() {
  const lookups = useLookups()
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fileName, setFileName] = useState("")
  const [busy, setBusy] = useState(false)

  async function pick(file: File) {
    setBusy(true)
    try {
      const result = await parseImport(file, {
        classes: lookups.classes,
        subjects: lookups.subjects,
        periods: lookups.periods,
      })
      setPreview(result)
      setFileName(file.name)
      if (!result.rows.length) toast.error("ردیف قابل ثبتی پیدا نشد")
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    if (!preview) return
    setBusy(true)
    try {
      const count = await commitImport(preview.rows)
      toast.success(`${count} طرح اضافه شد`)
      setPreview(null)
      setFileName("")
      if (input.current) input.current.value = ""
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  const errors =
    preview?.issues.filter((issue) => issue.level === "error") ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>ورود از اکسل</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Input
          ref={input}
          type="file"
          accept=".xlsx,.xls"
          disabled={busy}
          aria-label="انتخاب فایل اکسل"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void pick(file)
          }}
        />

        {preview && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              {fileName}: {preview.rows.length} ردیف آماده ثبت
              {errors.length ? `، ${errors.length} ردیف رد شد` : ""}
            </p>

            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {preview.rows.slice(0, 20).map((row) => (
                <li
                  key={row.row}
                  className="flex justify-between gap-2 rounded-md bg-muted px-2 py-1"
                >
                  <span>{formatShortDate(fromISODate(row.date))}</span>
                  <span className="truncate text-muted-foreground">
                    {row.activity}
                  </span>
                </li>
              ))}
            </ul>

            {preview.issues.length > 0 && (
              <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-xs">
                {preview.issues.slice(0, 20).map((issue, index) => (
                  <li
                    key={`${issue.row}-${index}`}
                    className={
                      issue.level === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    سطر {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
            )}

            <Button
              type="button"
              disabled={busy || !preview.rows.length}
              onClick={() => void commit()}
            >
              <Upload />
              ثبت {preview.rows.length} طرح
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── SECTION ────────────────────────────────────────────────

export function ExcelSection() {
  return (
    <>
      <ExportCard />
      <ImportCard />
    </>
  )
}
