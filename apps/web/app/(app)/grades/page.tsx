"use client"

import { GraduationCap } from "lucide-react"
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
import { StudentsSection } from "@/features/grades/students-section"
import { useSchools } from "@/features/grades/hooks"
import { useClasses, useSubjects } from "@/features/teaching/hooks"

const SELECT_ALL = "__all__"

export default function GradesPage() {
  const schools = useSchools()
  const classes = useClasses()
  const subjects = useSubjects()

  const [schoolId, setSchoolId] = useState<string>("")
  const [classId, setClassId] = useState<string>("")
  const [subjectId, setSubjectId] = useState<string>("")

  const visibleClasses = (classes ?? []).filter(
    (c) => !schoolId || schoolId === SELECT_ALL || c.school_id === schoolId
  )
  const ready = classId && subjectId

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-lg">نمره‌ها</h1>
        <p className="text-sm text-muted-foreground">
          سه قدم: مدرسه و کلاس و درس انتخاب کن، نمره بده.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>۱. انتخاب مدرسه، کلاس و درس</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Picker
            label="مدرسه"
            value={schoolId}
            onChange={(v) => {
              setSchoolId(v === SELECT_ALL ? "" : v)
              setClassId("")
            }}
            placeholder="مدرسه…"
            loading={schools === undefined}
            empty="اول از تنظیمات مدرسه بسازید."
            items={(schools ?? []).map((s) => ({ id: s.id, name: s.name }))}
            allowAll
          />
          <Picker
            label="کلاس"
            value={classId}
            onChange={setClassId}
            placeholder="کلاس…"
            loading={classes === undefined}
            empty="اول از تنظیمات کلاس بسازید."
            items={visibleClasses.map((c) => ({ id: c.id, name: c.name }))}
          />
          <Picker
            label="درس"
            value={subjectId}
            onChange={setSubjectId}
            placeholder="درس…"
            loading={subjects === undefined}
            empty="اول از تنظیمات درس بسازید."
            items={(subjects ?? []).map((s) => ({ id: s.id, name: s.name }))}
          />
        </CardContent>
      </Card>

      {!ready ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-foreground/10 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <GraduationCap className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">کلاس و درس را انتخاب کنید</p>
            <p className="text-xs text-muted-foreground">
              بعد فهرست دانش‌آموزان و جدول نمره همین‌جا می‌آید.
            </p>
          </div>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>۲. دانش‌آموزان کلاس</CardTitle>
            </CardHeader>
            <CardContent>
              <StudentsSection classId={classId} />
            </CardContent>
          </Card>
          <GradesSectionWithHeading subjectId={subjectId} classId={classId} />
        </>
      )}
    </div>
  )
}

function GradesSectionWithHeading({
  subjectId,
  classId,
}: {
  subjectId: string
  classId: string
}) {
  return (
    <section aria-label="نمره‌های درس" className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">۳. جدول نمره</h2>
      <GradesSection subjectId={subjectId} classId={classId} />
    </section>
  )
}

function Picker({
  label,
  value,
  onChange,
  placeholder,
  loading,
  empty,
  items,
  allowAll = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  loading: boolean
  empty: string
  items: { id: string; name: string }[]
  allowAll?: boolean
}) {
  if (loading) return <Skeleton className="h-10 w-full" />
  if (items.length === 0 && !allowAll) {
    return (
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{label}</span>
        <span className="rounded-lg border border-dashed border-foreground/10 px-3 py-2 text-xs text-muted-foreground">
          {empty}
        </span>
      </div>
    )
  }
  // Base UI renders the trigger label from `items`, not from <SelectItem>
  // children: without it the trigger stays on placeholder after selection.
  const rootItems = [
    ...(allowAll ? [{ label: "همه", value: SELECT_ALL }] : []),
    ...items.map((item) => ({ label: item.name, value: item.id })),
  ]
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label className="font-medium">{label}</label>
      <Select
        items={rootItems}
        value={value || null}
        onValueChange={(v) => onChange(v ?? "")}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectLabel>{label}</SelectLabel>
            {allowAll && <SelectItem value={SELECT_ALL}>همه</SelectItem>}
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
