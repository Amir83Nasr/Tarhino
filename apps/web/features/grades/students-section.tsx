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
import { parseFullName } from "@/features/teaching/api"
import { ApiError } from "@/lib/api/client"

function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "ذخیره نشد")
}

export function StudentsSection({ classId }: { classId: string }) {
  const students = useStudents(classId)
  const mutations = useStudentMutations(classId)
  const [first, setFirst] = useState("")
  const [last, setLast] = useState("")
  const [query, setQuery] = useState("")
  const [bulk, setBulk] = useState("")
  const [bulkOpen, setBulkOpen] = useState(false)

  const filtered = (students ?? []).filter((s) =>
    `${s.first_name} ${s.last_name}`.includes(query.trim())
  )

  function add(event: React.FormEvent) {
    event.preventDefault()
    const firstName = first.trim()
    const lastName = last.trim()
    if (!firstName || !lastName) {
      toast.error("نام و نام خانوادگی را بنویسید")
      return
    }
    setFirst("")
    setLast("")
    mutations.create.mutate(
      { class_id: classId, first_name: firstName, last_name: lastName },
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>دانش‌آموزان</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
          <ul className="flex flex-col gap-2">
            {filtered.map((student) => (
              <StudentRow
                key={student.id}
                id={student.id}
                firstName={student.first_name}
                lastName={student.last_name}
                classId={classId}
              />
            ))}
          </ul>
        )}

        <form className="flex flex-wrap items-center gap-2" onSubmit={add}>
          <Input
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder="نام"
            aria-label="نام"
            className="min-w-28 flex-1"
          />
          <Input
            value={last}
            onChange={(e) => setLast(e.target.value)}
            placeholder="نام خانوادگی"
            aria-label="نام خانوادگی"
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
      </CardContent>
    </Card>
  )
}

function StudentRow({
  id,
  firstName,
  lastName,
  classId,
}: {
  id: string
  firstName: string
  lastName: string
  classId: string
}) {
  const mutations = useStudentMutations(classId)
  const [first, setFirst] = useState(firstName)
  const [last, setLast] = useState(lastName)

  function save() {
    const patch = {
      ...(first.trim() && first.trim() !== firstName
        ? { first_name: first.trim() }
        : {}),
      ...(last.trim() && last.trim() !== lastName
        ? { last_name: last.trim() }
        : {}),
    }
    if (!Object.keys(patch).length) {
      setFirst(firstName)
      setLast(lastName)
      return
    }
    mutations.save.mutate({ id, patch }, { onError: fail })
  }

  return (
    <li className="flex items-center gap-2">
      <Input
        value={first}
        onChange={(e) => setFirst(e.target.value)}
        onBlur={save}
        aria-label="نام"
      />
      <Input
        value={last}
        onChange={(e) => setLast(e.target.value)}
        onBlur={save}
        aria-label="نام خانوادگی"
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
