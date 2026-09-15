"use client"

import { useState } from "react"

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

import { useStudentMutations, useStudents } from "@/features/grades/hooks"
import { parseFullName, studentDisplayName } from "@/features/teaching/api"
import { ApiError } from "@/lib/api/client"

function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "ذخیره نشد")
}

const displayName = studentDisplayName

export function StudentsSection({
  classId,
  bare = false,
}: {
  classId: string
  bare?: boolean
}) {
  const students = useStudents(classId)
  const mutations = useStudentMutations(classId)
  const [full, setFull] = useState("")
  const [query, setQuery] = useState("")
  const [bulk, setBulk] = useState("")
  const [bulkOpen, setBulkOpen] = useState(false)

  const filtered = (students ?? [])
    .filter((s) => displayName(s).includes(query.trim()))
    .sort(
      (a, b) =>
        (a.last_name === "—" ? "" : a.last_name).localeCompare(
          b.last_name === "—" ? "" : b.last_name,
          "fa"
        ) || a.first_name.localeCompare(b.first_name, "fa")
    )

  function add(event: React.FormEvent) {
    event.preventDefault()
    const name = full.trim()
    if (!name) {
      toast.error("نام و نام خانوادگی را بنویسید")
      return
    }
    const { first_name, last_name } = parseFullName(name)
    if (!first_name) {
      toast.error("نام و نام خانوادگی را بنویسید")
      return
    }
    setFull("")
    mutations.create.mutate(
      { class_id: classId, first_name, last_name },
      { onError: fail }
    )
  }

  function runBulk() {
    const names = bulk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    if (!names.length) {
      toast.error("اول چند نام بچسبانید")
      return
    }
    const items = names.map(parseFullName)
    if (items.some((i) => !i.first_name)) {
      toast.error("یک سطر خالی یا نامعتبر است")
      return
    }
    setBulk("")
    setBulkOpen(false)
    mutations.bulk.mutate(names, {
      onSuccess: (saved) => toast.success(`${saved.length} دانش‌آموز اضافه شد`),
      onError: fail,
    })
  }

  // bare: reused inside another Card (settings section, grades page).
  const body = (
    <>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="جست‌وجو…"
        aria-label="جست‌وجوی دانش‌آموز"
      />

      {students === undefined ? (
        Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/10 py-3 text-center text-xs text-muted-foreground">
          {students.length ? "چیزی پیدا نشد." : "هنوز دانش‌آموزی نیست."}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {filtered.map((student, i) => (
            <StudentRow
              key={`${student.id}-${displayName(student)}`}
              id={student.id}
              fullName={displayName(student)}
              classId={classId}
              index={i}
            />
          ))}
        </ol>
      )}

      <form className="flex flex-wrap items-center gap-2" onSubmit={add}>
        <Input
          value={full}
          onChange={(e) => setFull(e.target.value)}
          placeholder="نام و نام خانوادگی"
          aria-label="نام و نام خانوادگی"
          className="min-w-28 flex-1"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={mutations.create.isPending}
        >
          {mutations.create.isPending ? "…" : "افزودن"}
        </Button>
      </form>

      {bulkOpen ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"علی احمدی\nمحمد رضایی"}
            rows={4}
            dir="rtl"
            aria-label="فهرست نام‌ها"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={runBulk}
              disabled={mutations.bulk.isPending}
            >
              {mutations.bulk.isPending ? "…" : "ثبت گروهی"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setBulkOpen(false)}
            >
              بستن
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => setBulkOpen(true)}
        >
          افزودن گروهی (چسباندن فهرست)…
        </Button>
      )}
    </>
  )

  if (bare) return <div className="flex flex-col gap-3">{body}</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>دانش‌آموزان</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{body}</CardContent>
    </Card>
  )
}

function StudentRow({
  id,
  fullName,
  classId,
  index,
}: {
  id: string
  fullName: string
  classId: string
  index: number
}) {
  const mutations = useStudentMutations(classId)
  const [full, setFull] = useState(fullName)

  function save() {
    const name = full.trim()
    if (!name || name === fullName) {
      setFull(fullName)
      return
    }
    const { first_name, last_name } = parseFullName(name)
    if (!first_name) {
      setFull(fullName)
      return
    }
    mutations.save.mutate(
      { id, patch: { first_name, last_name } },
      { onError: fail }
    )
  }

  return (
    <li className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <Input
        value={full}
        onChange={(e) => setFull(e.target.value)}
        onBlur={save}
        aria-label="نام و نام خانوادگی"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="حذف دانش‌آموز"
        disabled={mutations.remove.isPending}
        onClick={() => mutations.remove.mutate(id, { onError: fail })}
      >
        ×
      </Button>
    </li>
  )
}
