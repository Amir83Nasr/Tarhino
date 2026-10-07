"use client"

import { useState } from "react"

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

import { GradesSection } from "@/features/grades/grades-table"
import { ReportCardsSection } from "@/features/grades/report-cards-section"
import {
  useClasses,
  useClassSubjects,
  useSubjects,
} from "@/features/teaching/hooks"

// Single class: pick the subject, students live only inside the table.
export default function GradesPage() {
  const classes = useClasses()
  const subjects = useSubjects()
  const singleClassId = classes?.[0]?.id ?? ""

  const [subjectId, setSubjectId] = useState<string>("")
  const firstId = (subjects ?? [])[0]?.id ?? ""
  const activeId = subjectId || firstId

  const links = useClassSubjects(singleClassId || null)
  const linkedIds =
    links === undefined ? null : new Set(links.map((l) => l.subject_id))
  const visibleSubjects = (subjects ?? []).filter(
    (s) => linkedIds === null || linkedIds.has(s.id)
  )
  const ready = singleClassId && subjectId

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-lg">کارنامه</h1>
        <p className="text-sm text-muted-foreground">
          سطح توصیفی هر دانش‌آموز.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>درس</CardTitle>
        </CardHeader>
        <CardContent>
          {subjects === undefined || classes === undefined ? (
            <Skeleton className="h-10 w-full" />
          ) : !singleClassId ? (
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="rounded-lg border border-dashed border-foreground/10 px-3 py-2 text-xs text-muted-foreground">
                اول از تنظیمات کلاس بسازید.
              </span>
            </div>
          ) : visibleSubjects.length === 0 ? (
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="rounded-lg border border-dashed border-foreground/10 px-3 py-2 text-xs text-muted-foreground">
                هنوز درسی نیست؛ کلاس را از تنظیمات دوباره ذخیره کنید تا درس‌های
                پایه ساخته شود.
              </span>
            </div>
          ) : visibleSubjects.length === 1 ? (
            <p className="text-sm font-medium">{visibleSubjects[0]?.name}</p>
          ) : (
            <SubjectPicker
              value={activeId}
              onChange={setSubjectId}
              items={visibleSubjects.map((s) => ({ id: s.id, name: s.name }))}
            />
          )}
        </CardContent>
      </Card>

      {ready ? (
        <>
          <GradesSection subjectId={activeId} classId={singleClassId} />
          <ReportCardsSection classId={singleClassId} />
        </>
      ) : null}
    </div>
  )
}

function SubjectPicker({
  value,
  onChange,
  items,
}: {
  value: string
  onChange: (value: string) => void
  items: { id: string; name: string }[]
}) {
  // Base UI renders the trigger label from `items`, not from <SelectItem>
  // children: without it the trigger stays on placeholder after selection.
  const rootItems = items.map((item) => ({
    label: item.name,
    value: item.id,
  }))
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label className="font-medium">درس</label>
      <Select
        items={rootItems}
        value={value || null}
        onValueChange={(v) => onChange(v ?? "")}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="درس…" />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectLabel>درس</SelectLabel>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
