"use client"

import { FileDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
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

import {
  useAssessmentMutations,
  useGradebook,
  useStudents,
  useUpsertGrade,
} from "@/features/grades/hooks"
import { downloadGradeSheetPdf } from "@/features/reports/api"
import { DEFAULT_LEVELS, studentDisplayName } from "@/features/teaching/api"
import { ApiError } from "@/lib/api/client"
import type { Assessment } from "@/lib/api/types"

function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "ذخیره نشد")
}

export function GradesSection({
  subjectId,
  classId,
}: {
  subjectId: string
  classId: string
}) {
  const book = useGradebook(subjectId)
  const students = useStudents(classId)
  const mutations = useAssessmentMutations(subjectId)
  const [draft, setDraft] = useState("")

  function add(event: React.FormEvent) {
    event.preventDefault()
    const title = draft.trim()
    if (!title) return
    setDraft("")
    mutations.create.mutate(title, { onError: fail })
  }

  const [pdfBusy, setPdfBusy] = useState(false)

  // Same data as the grid: no extra fetch, the backend pivots gradebook rows.
  async function downloadSheet() {
    setPdfBusy(true)
    try {
      await downloadGradeSheetPdf(subjectId, classId)
      toast.success("فایل پی‌دی‌اف ذخیره شد")
    } catch {
      toast.error("دانلود انجام نشد")
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle className="me-auto">کارنامه</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pdfBusy || book === undefined || !book.assessments.length}
          onClick={() => void downloadSheet()}
          title="کارنامه به صورت پی‌دی‌اف"
        >
          <FileDown />
          کارنامه (پی‌دی‌اف)
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {book === undefined ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <AssessmentChips
            assessments={book.assessments}
            subjectId={subjectId}
          />
        )}

        <form className="flex items-center gap-2" onSubmit={add}>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="مثلاً امتحان اول"
            aria-label="نام ارزشیابی"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={mutations.create.isPending || !draft.trim()}
          >
            {mutations.create.isPending ? "…" : "افزودن ارزشیابی"}
          </Button>
        </form>

        {book !== undefined && (
          <GradesGrid subjectId={subjectId} students={students} />
        )}
      </CardContent>
    </Card>
  )
}

function AssessmentChips({
  assessments,
  subjectId,
}: {
  assessments: Assessment[]
  subjectId: string
}) {
  const mutations = useAssessmentMutations(subjectId)
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState("")

  if (!assessments.length) {
    return (
      <p className="rounded-lg border border-dashed border-foreground/10 py-3 text-center text-xs text-muted-foreground">
        هنوز ارزشیابی نیست؛ بالا یکی بسازید.
      </p>
    )
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {assessments.map((a) => (
        <li
          key={a.id}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs ring-1 ring-foreground/10"
        >
          {editing === a.id ? (
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                const next = title.trim()
                setEditing(null)
                if (next && next !== a.title)
                  mutations.rename.mutate(
                    { id: a.id, title: next },
                    { onError: fail }
                  )
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                if (e.key === "Escape") setEditing(null)
              }}
              className="h-7 w-28"
              aria-label="نام ارزشیابی"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditing(a.id)
                setTitle(a.title)
              }}
              title="تغییر نام"
              className="font-medium"
            >
              {a.title}
            </button>
          )}
          <button
            type="button"
            aria-label={`حذف ${a.title}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={() => mutations.remove.mutate(a.id, { onError: fail })}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── SPREADSHEET GRID ───────────────────────────────────────
// Descriptive-only: one level select per cell. Enter/Tab move within the
// grid via refs.

function GradesGrid({
  subjectId,
  students,
}: {
  subjectId: string
  students: ReturnType<typeof useStudents>
}) {
  const book = useGradebook(subjectId)
  const upsert = useUpsertGrade(subjectId)
  const seeded = useRef<string | null>(null)

  const assessments = book?.assessments ?? []
  const grades = book?.grades ?? []

  // Default every empty cell to "خیلی خوب". Runs once per
  // subject/assessment/roster combo; later students/assessments seed only
  // their own missing cells. On error the key resets so it retries.
  useEffect(() => {
    if (book === undefined || !students?.length || !assessments.length) return
    const key = `${subjectId}:${assessments.map((a) => a.id).join(",")}:${students.map((s) => s.id).join(",")}`
    if (seeded.current === key) return
    const have = new Set(
      grades.map((g) => `${g.student_id}:${g.assessment_id}`)
    )
    const missing: { studentId: string; assessmentId: string }[] = []
    for (const student of students) {
      for (const assessment of assessments) {
        if (!have.has(`${student.id}:${assessment.id}`))
          missing.push({ studentId: student.id, assessmentId: assessment.id })
      }
    }
    seeded.current = key
    if (!missing.length) return
    let warned = false
    for (const cell of missing) {
      upsert.mutate(
        { ...cell, grade: { level: DEFAULT_LEVELS[0] } },
        {
          onError: (error) => {
            // Keep the key: no retry loop. Refreshing the page reseeds.
            if (!warned) {
              warned = true
              fail(error)
            }
          },
        }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, students, subjectId])

  if (book === undefined) return <Skeleton className="h-32 w-full" />
  if (!students) return <Skeleton className="h-20 w-full" />
  if (!students.length) {
    return (
      <p className="rounded-lg border border-dashed border-foreground/10 py-3 text-center text-xs text-muted-foreground">
        اول از بخش دانش‌آموزان شاگرد اضافه کنید.
      </p>
    )
  }

  const cellOf = (studentId: string, assessmentId: string) =>
    grades.find(
      (g) => g.student_id === studentId && g.assessment_id === assessmentId
    )

  function pickLevel(studentId: string, assessmentId: string, level: string) {
    const current = cellOf(studentId, assessmentId)?.label
    if (current === level) return
    upsert.mutate(
      { studentId, assessmentId, grade: { level } },
      { onError: fail }
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky right-0 border-b border-foreground/10 bg-muted/80 px-3 py-2 text-start font-medium backdrop-blur">
              دانش‌آموز
            </th>
            {assessments.map((a) => (
              <th
                key={a.id}
                className="border-b border-foreground/10 px-2 py-2 text-center font-medium whitespace-nowrap"
              >
                {a.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr
              key={student.id}
              className="border-b border-foreground/10 last:border-0"
            >
              <th
                scope="row"
                className="sticky right-0 bg-background px-3 py-1.5 text-start font-normal whitespace-nowrap"
              >
                {studentDisplayName(student)}
              </th>
              {assessments.map((a) => {
                const cell = cellOf(student.id, a.id)
                return (
                  <td key={a.id} className="px-1 py-1">
                    <LevelCell
                      key={`${student.id}:${a.id}:${cell?.label ?? "empty"}`}
                      level={cell?.label}
                      onPick={(label) => pickLevel(student.id, a.id, label)}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Descriptive: no numbers in or out, just the fixed levels.
function LevelCell({
  level,
  onPick,
}: {
  level: string | undefined
  onPick: (label: string) => void
}) {
  const levels = DEFAULT_LEVELS
  // Base UI renders the trigger label from `items`: without it the trigger
  // stays on placeholder after selection.
  const items = levels.map((label) => ({ label, value: label }))
  return (
    <Select
      items={items}
      value={
        level && (levels as readonly string[]).includes(level) ? level : null
      }
      onValueChange={(v) => {
        if (v) onPick(v)
      }}
    >
      <SelectTrigger className="mx-auto w-20 text-xs" aria-label="سطح">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectLabel>سطح</SelectLabel>
          {levels.map((label) => (
            <SelectItem key={label} value={label}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
