"use client"

import { useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "@workspace/ui/components/sonner"

import {
  useAssessmentMutations,
  useGradebook,
  useStudents,
  useUpsertGrade,
} from "@/features/grades/hooks"
import { parseGradeValue } from "@/features/teaching/api"
import { ApiError } from "@/lib/api/client"
import { toPersianDigits } from "@/lib/date/jalali"
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>نمره‌ها</CardTitle>
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
// One input per cell; Enter/Tab move within the grid via input refs.
// Invalid values shake back to the server value, never saved.

function GradesGrid({
  subjectId,
  students,
}: {
  subjectId: string
  students: ReturnType<typeof useStudents>
}) {
  const book = useGradebook(subjectId)
  const upsert = useUpsertGrade(subjectId)
  const refs = useRef(new Map<string, HTMLInputElement>())

  if (book === undefined) return <Skeleton className="h-32 w-full" />
  const { assessments, grades } = book
  if (!assessments.length) return null
  if (!students) return <Skeleton className="h-20 w-full" />
  if (!students.length) {
    return (
      <p className="rounded-lg border border-dashed border-foreground/10 py-3 text-center text-xs text-muted-foreground">
        اول از بخش دانش‌آموزان شاگرد اضافه کنید.
      </p>
    )
  }

  const valueOf = (studentId: string, assessmentId: string) =>
    grades.find(
      (g) => g.student_id === studentId && g.assessment_id === assessmentId
    )?.value

  function cellKey(row: number, col: number) {
    return `${row}:${col}`
  }

  function focusCell(row: number, col: number) {
    const maxRow = students!.length - 1
    const maxCol = assessments.length - 1
    const r = Math.min(Math.max(row, 0), maxRow)
    const c = Math.min(Math.max(col, 0), maxCol)
    refs.current.get(cellKey(r, c))?.focus()
    refs.current.get(cellKey(r, c))?.select()
  }

  function commit(studentId: string, assessmentId: string, raw: string) {
    const parsed = parseGradeValue(raw)
    if (parsed === null) {
      if (raw.trim()) toast.error("نمره باید بین ۰ تا ۲۰ باشد")
      return false
    }
    const current = valueOf(studentId, assessmentId)
    if (current !== undefined && Number(current) === parsed) return true
    upsert.mutate({ studentId, assessmentId, value: parsed }, { onError: fail })
    return true
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
          {students.map((student, row) => (
            <tr
              key={student.id}
              className="border-b border-foreground/10 last:border-0"
            >
              <th
                scope="row"
                className="sticky right-0 bg-background px-3 py-1.5 text-start font-normal whitespace-nowrap"
              >
                {student.first_name} {student.last_name}
              </th>
              {assessments.map((a, col) => {
                const current = valueOf(student.id, a.id)
                return (
                  <td key={a.id} className="px-1 py-1">
                    <GradeCell
                      key={`${student.id}:${a.id}:${current ?? "empty"}`}
                      initial={current}
                      inputRef={(el) => {
                        const k = cellKey(row, col)
                        if (el) refs.current.set(k, el)
                        else refs.current.delete(k)
                      }}
                      onCommit={(raw) => commit(student.id, a.id, raw)}
                      onMove={(direction) => {
                        if (direction === "down") focusCell(row + 1, col)
                        else if (direction === "up") focusCell(row - 1, col)
                        else if (direction === "next") {
                          if (col + 1 < assessments.length)
                            focusCell(row, col + 1)
                          else focusCell(row + 1, 0)
                        } else {
                          if (col > 0) focusCell(row, col - 1)
                          else focusCell(row - 1, assessments.length - 1)
                        }
                      }}
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

function GradeCell({
  initial,
  inputRef,
  onCommit,
  onMove,
}: {
  initial: number | undefined
  inputRef: (el: HTMLInputElement | null) => void
  onCommit: (raw: string) => boolean
  onMove: (direction: "down" | "up" | "next" | "prev") => void
}) {
  // Uncontrolled: defaultValue from server, local edits stay local until blur.
  const display =
    initial === undefined ? "" : toPersianDigits(String(Number(initial)))
  const [bad, setBad] = useState(false)

  return (
    <input
      ref={inputRef}
      defaultValue={display}
      inputMode="decimal"
      aria-label="نمره"
      onFocus={(e) => e.target.select()}
      onBlur={(e) => {
        if (!onCommit(e.target.value)) {
          e.target.value = display
          setBad(true)
          window.setTimeout(() => setBad(false), 600)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          const ok = onCommit(e.currentTarget.value)
          if (!ok) e.currentTarget.value = display
          onMove(e.shiftKey ? "up" : "down")
        } else if (e.key === "Tab") {
          e.preventDefault()
          const ok = onCommit(e.currentTarget.value)
          if (!ok) e.currentTarget.value = display
          onMove(e.shiftKey ? "prev" : "next")
        } else if (e.key === "ArrowDown") {
          e.preventDefault()
          onMove("down")
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          onMove("up")
        }
      }}
      className={`h-9 w-20 rounded-md border bg-transparent px-2 text-center tabular-nums outline-none focus-visible:border-ring ${bad ? "border-destructive" : "border-transparent hover:border-input focus-visible:border-ring"}`}
    />
  )
}
