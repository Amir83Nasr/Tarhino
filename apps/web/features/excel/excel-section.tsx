"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Download, Upload } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { toast } from "@workspace/ui/components/sonner"

import { ApiError } from "@/lib/api/client"
import {
  commitImport,
  exportLessonPlans,
  parseImport,
  type ImportPreview,
} from "@/features/excel/import-export"
import { appendPlansToCache, useLookups } from "@/features/teaching/hooks"
import { formatNumericDate, fromISODate } from "@/lib/date/jalali"
import { JalaliDatePicker } from "@/components/jalali-date-picker"

// Export a Jalali range, or import a file back. Import is preview-first: parse()
// validates, the list below shows what would land, and only "ثبت" writes.

// ── SHARED ─────────────────────────────────────────────────

// ApiError messages are Persian (translated in client.ts); anything else (a
// corrupt workbook, browser/network internals) must not leak English into the toast.
function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "انجام نشد")
}

// ── EXPORT ─────────────────────────────────────────────────

function ExportCard() {
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!from || !to) {
      toast.error("هر دو تاریخ را انتخاب کنید")
      return
    }
    if (to < from) {
      toast.error("تاریخ پایان باید بعد از شروع باشد")
      return
    }

    setBusy(true)
    try {
      const count = await exportLessonPlans(from, to)
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
          <JalaliDatePicker
            value={from}
            onChange={setFrom}
            placeholder="از تاریخ"
            ariaLabel="از تاریخ"
            className="flex-1"
          />
          <JalaliDatePicker
            value={to}
            onChange={setTo}
            placeholder="تا تاریخ"
            ariaLabel="تا تاریخ"
            className="flex-1"
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
  const queryClient = useQueryClient()
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
      const { count, saved } = await commitImport(preview.rows)
      // Temp ids cannot exist here — commit never wrote optimistic rows.
      appendPlansToCache(queryClient, saved)
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
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void pick(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload />
          انتخاب فایل اکسل
        </Button>

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
                  <span>{formatNumericDate(fromISODate(row.date))}</span>
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
