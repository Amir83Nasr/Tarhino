"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"

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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import {
  addClass,
  addPeriod,
  addSchool,
  addSubject,
  removeClass,
  removePeriod,
  removeSchool,
  removeSubject,
  renameClassAction,
  renameSchoolAction,
  renameSubjectAction,
  saveClassSchool,
  savePeriodAction,
} from "@/features/settings/api"
import { TimeInput } from "@/components/time-input"
import { useSchools } from "@/features/settings/school-options"
import { useClasses, usePeriods, useSubjects } from "@/features/teaching/hooks"
import { ApiError } from "@/lib/api/client"
import type { Period } from "@/lib/api/types"

// Optimistic writes: the list updates instantly, the server confirms in the
// background. Rollback on error; refetch on settle to swap temp ids.

// ── SHARED ─────────────────────────────────────────────────

type NamedMutations = {
  create: ReturnType<typeof useMutation<unknown, unknown, string>>
  rename: ReturnType<
    typeof useMutation<unknown, unknown, { id: string; name: string }>
  >
  remove: ReturnType<typeof useMutation<unknown, unknown, string>>
  assignSchool?: ReturnType<
    typeof useMutation<
      unknown,
      unknown,
      { id: string; schoolId: string | null }
    >
  >
}

function DeleteButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onClick}
            disabled={disabled}
            aria-label="حذف"
          />
        }
      >
        <Trash2 />
      </TooltipTrigger>
      <TooltipContent>حذف</TooltipContent>
    </Tooltip>
  )
}

// ApiError messages are Persian (translated in client.ts); anything else
// (browser/network internals) must not leak English into the toast.
function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "ذخیره نشد")
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-foreground/10 py-3 text-center text-xs text-muted-foreground">
      {text}
    </p>
  )
}

// ── NAMED LISTS (CLASSES / SUBJECTS) ───────────────────────

function NamedSection<T extends { id: string; name: string }>({
  title,
  placeholder,
  empty,
  items,
  mutations,
  schools,
  schoolOf,
  onSchool,
}: {
  title: string
  placeholder: string
  empty: string
  items: T[] | undefined
  mutations: NamedMutations
  schools?: { id: string; name: string }[]
  schoolOf?: (id: string) => string | null
  onSchool?: (id: string, schoolId: string | null) => void
}) {
  const [draft, setDraft] = useState("")
  const pending = mutations.create.isPending

  function create(event: React.FormEvent) {
    event.preventDefault()
    const name = draft.trim()
    if (!name) return
    setDraft("")
    mutations.create.mutate(name, { onError: fail })
  }

  function rename(item: T, name: string) {
    if (!name || name === item.name) return
    mutations.rename.mutate({ id: item.id, name }, { onError: fail })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items === undefined ? (
          Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))
        ) : items.length === 0 ? (
          <EmptyHint text={empty} />
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <Input
                key={item.name}
                defaultValue={item.name}
                onBlur={(e) => {
                  const name = e.target.value.trim()
                  if (name && name !== item.name) rename(item, name)
                  else e.target.value = item.name
                }}
              />
              {schools && schoolOf && onSchool && (
                <Select
                  items={[
                    { label: "بی‌مدرسه", value: null as string | null },
                    ...schools.map((s) => ({
                      label: s.name,
                      value: s.id as string | null,
                    })),
                  ]}
                  value={schoolOf(item.id) ?? null}
                  onValueChange={(v) => onSchool(item.id, v ?? null)}
                >
                  <SelectTrigger
                    aria-label="مدرسه کلاس"
                    className="max-w-32 shrink-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectLabel>مدرسه</SelectLabel>
                      <SelectItem value={null}>بی‌مدرسه</SelectItem>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <DeleteButton
                disabled={mutations.remove.isPending}
                onClick={() =>
                  mutations.remove.mutate(item.id, { onError: fail })
                }
              />
            </div>
          ))
        )}

        <form className="flex items-center gap-2" onSubmit={create}>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={pending || !draft.trim()}
          >
            {pending ? "…" : "افزودن"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

type NamedItem = { id: string; name: string }

// The server returns the saved row; onSuccess swaps it in so create/rename
// need no refetch. Deletes return 204 and are already removed from cache.
function useNamedMutations(
  kind: "classes" | "subjects" | "schools"
): NamedMutations {
  const client = useQueryClient()
  const key = [kind]
  const isClass = kind === "classes"
  const isSchool = kind === "schools"

  async function snapshot() {
    await client.cancelQueries({ queryKey: key })
    return client.getQueryData<NamedItem[]>(key)
  }

  const create = useMutation({
    mutationFn: (name: string) =>
      isClass ? addClass(name) : isSchool ? addSchool(name) : addSubject(name),
    onMutate: async (name) => {
      const previous = await snapshot()
      const now = new Date().toISOString()
      const temp: NamedItem = { id: `temp-${now}`, name }
      client.setQueryData<NamedItem[]>(key, (old) => [...(old ?? []), temp])
      return { previous, tempId: temp.id }
    },
    onSuccess: (saved, _v, context) => {
      client.setQueryData<NamedItem[]>(key, (old) =>
        (old ?? [])
          .filter((item) => item.id !== context?.tempId)
          .concat(saved as NamedItem)
      )
    },
    onError: (_e, _v, context) =>
      context?.previous !== undefined &&
      client.setQueryData(key, context.previous),
  })
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      isClass
        ? renameClassAction(id, name)
        : isSchool
          ? renameSchoolAction(id, name)
          : renameSubjectAction(id, name),
    onMutate: async ({ id, name }) => {
      const previous = await snapshot()
      client.setQueryData<NamedItem[]>(key, (old) =>
        old?.map((item) => (item.id === id ? { ...item, name } : item))
      )
      return { previous }
    },
    onSuccess: (saved) => {
      client.setQueryData<NamedItem[]>(key, (old) =>
        old?.map((item) =>
          item.id === (saved as NamedItem).id ? (saved as NamedItem) : item
        )
      )
    },
    onError: (_e, _v, context) =>
      context?.previous !== undefined &&
      client.setQueryData(key, context.previous),
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      isClass
        ? removeClass(id)
        : isSchool
          ? removeSchool(id)
          : removeSubject(id),
    onMutate: async (id) => {
      const previous = await snapshot()
      client.setQueryData<NamedItem[]>(key, (old) =>
        old?.filter((item) => item.id !== id)
      )
      return { previous }
    },
    onError: (_e, _v, context) =>
      context?.previous !== undefined &&
      client.setQueryData(key, context.previous),
  })
  const assignSchool = useMutation({
    mutationFn: ({ id, schoolId }: { id: string; schoolId: string | null }) =>
      saveClassSchool(id, schoolId),
    onMutate: async ({ id, schoolId }) => {
      await client.cancelQueries({ queryKey: ["classes"] })
      const previous = client.getQueryData<
        { id: string; school_id: string | null }[]
      >(["classes"])
      client.setQueryData<{ id: string; school_id: string | null }[]>(
        ["classes"],
        (old) =>
          old?.map((c) => (c.id === id ? { ...c, school_id: schoolId } : c))
      )
      return { previous }
    },
    onSuccess: (saved) => {
      client.setQueryData(["classes"], (old: { id: string }[] | undefined) =>
        old?.map((c) => (c.id === (saved as { id: string }).id ? saved : c))
      )
    },
    onError: (_e, _v, context) => {
      const ctx = context as { previous?: unknown } | undefined
      if (ctx?.previous !== undefined)
        client.setQueryData(["classes"], ctx.previous)
    },
  })
  return { create, rename, remove, assignSchool }
}

export function SchoolsSection() {
  const schools = useSchools()
  const mutations = useNamedMutations("schools")
  return (
    <NamedSection
      title="مدرسه‌ها"
      placeholder="مثلاً دبیرستان فرزانگان"
      empty="هنوز مدرسه‌ای اضافه نشده."
      items={schools}
      mutations={mutations}
    />
  )
}

export function ClassesSection() {
  const classes = useClasses()
  const mutations = useNamedMutations("classes")
  const schools = useSchools()
  return (
    <NamedSection
      title="کلاس‌ها"
      placeholder="مثلاً هفتم الف"
      empty="هنوز کلاسی اضافه نشده."
      items={classes}
      mutations={mutations}
      schoolOf={(id) => classes?.find((c) => c.id === id)?.school_id ?? null}
      schools={(schools ?? []).map((s) => ({ id: s.id, name: s.name }))}
      onSchool={(id, schoolId) =>
        mutations.assignSchool?.mutate({ id, schoolId }, { onError: fail })
      }
    />
  )
}

export function SubjectsSection() {
  const subjects = useSubjects()
  const mutations = useNamedMutations("subjects")
  return (
    <NamedSection
      title="درس‌ها"
      placeholder="مثلاً ریاضی"
      empty="هنوز درسی اضافه نشده."
      items={subjects}
      mutations={mutations}
    />
  )
}

// ── PERIODS ────────────────────────────────────────────────

const toInput = (time: string) => time.slice(0, 5)

type PeriodPatch = {
  id: string
  label: string
  start: string
  end: string
  order_index: number
}

function usePeriodMutations() {
  const client = useQueryClient()
  const key = ["periods"] as const

  async function snapshot() {
    await client.cancelQueries({ queryKey: key })
    return client.getQueryData<Period[]>(key)
  }

  const save = useMutation({
    mutationFn: ({ id, label, start, end, order_index }: PeriodPatch) =>
      savePeriodAction(id, {
        label,
        start_time: start,
        end_time: end,
        order_index,
      }),
    onMutate: async (patch) => {
      const previous = await snapshot()
      client.setQueryData<Period[]>(key, (old) =>
        old?.map((p) =>
          p.id === patch.id
            ? {
                ...p,
                label: patch.label,
                start_time: patch.start,
                end_time: patch.end,
              }
            : p
        )
      )
      return { previous }
    },
    onSuccess: (saved) => {
      client.setQueryData<Period[]>(key, (old) =>
        old?.map((p) => (p.id === saved.id ? saved : p))
      )
    },
    onError: (_e, _v, context) =>
      context?.previous !== undefined &&
      client.setQueryData(key, context.previous),
  })
  const add = useMutation({
    mutationFn: ({
      label,
      start,
      end,
    }: {
      label: string
      start: string
      end: string
    }) =>
      // Optimistic temp row already appended; count live rows for the index.
      addPeriod(
        label,
        start,
        end,
        (client.getQueryData<Period[]>(key) ?? []).filter(
          (p) => !p.id.startsWith("temp-")
        ).length
      ),
    onMutate: async ({ label, start, end }) => {
      const previous = await snapshot()
      const now = new Date().toISOString()
      const temp: Period = {
        id: `temp-${now}`,
        created_at: now,
        updated_at: now,
        label,
        start_time: start,
        end_time: end,
        order_index: previous?.length ?? 0,
      }
      client.setQueryData<Period[]>(key, (old) => [...(old ?? []), temp])
      return { previous, tempId: temp.id }
    },
    // Server row wins: temp id swapped, no refetch needed.
    onSuccess: (saved, _v, context) => {
      client.setQueryData<Period[]>(key, (old) =>
        (old ?? []).filter((p) => p.id !== context?.tempId).concat(saved)
      )
    },
    onError: (_e, _v, context) =>
      context?.previous !== undefined &&
      client.setQueryData(key, context.previous),
  })
  // 204: row already removed from cache, nothing to refetch.
  const remove = useMutation({
    mutationFn: (id: string) => removePeriod(id),
    onMutate: async (id) => {
      const previous = await snapshot()
      client.setQueryData<Period[]>(key, (old) =>
        old?.filter((p) => p.id !== id)
      )
      return { previous }
    },
    onError: (_e, _v, context) =>
      context?.previous !== undefined &&
      client.setQueryData(key, context.previous),
  })
  return { save, add, remove }
}

function PeriodRow({
  period,
  index,
  mutations,
}: {
  period: Period
  index: number
  mutations: ReturnType<typeof usePeriodMutations>
}) {
  const [label, setLabel] = useState(period.label)
  const [start, setStart] = useState(toInput(period.start_time))
  const [end, setEnd] = useState(toInput(period.end_time))

  const dirty =
    label !== period.label ||
    start !== toInput(period.start_time) ||
    end !== toInput(period.end_time)

  function save() {
    if (end <= start) {
      toast.error("ساعت پایان باید بعد از شروع باشد")
      return
    }
    mutations.save.mutate(
      { id: period.id, label, start, end, order_index: index },
      { onError: fail }
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label="نام زنگ"
      />
      <TimeInput
        value={start}
        onChange={setStart}
        className="w-32 shrink-0"
        aria-label="شروع"
      />
      <TimeInput
        value={end}
        onChange={setEnd}
        className="w-32 shrink-0"
        aria-label="پایان"
      />
      <Button
        type="button"
        variant="outline"
        disabled={!dirty || mutations.save.isPending}
        onClick={save}
      >
        {mutations.save.isPending ? "…" : "ذخیره"}
      </Button>
      <DeleteButton
        disabled={mutations.remove.isPending}
        onClick={() => mutations.remove.mutate(period.id, { onError: fail })}
      />
    </div>
  )
}

export function PeriodsSection() {
  const periods = usePeriods()
  const mutations = usePeriodMutations()
  const [label, setLabel] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!label.trim() || !start || !end) {
      toast.error("نام و ساعت زنگ را کامل کنید")
      return
    }
    if (end <= start) {
      toast.error("ساعت پایان باید بعد از شروع باشد")
      return
    }
    mutations.add.mutate(
      { label: label.trim(), start, end },
      {
        onSuccess: () => {
          setLabel("")
          setStart("")
          setEnd("")
        },
        onError: fail,
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>زنگ‌ها</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {periods === undefined ? (
          Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))
        ) : periods.length === 0 ? (
          <EmptyHint text="هنوز زنگی اضافه نشده." />
        ) : (
          periods.map((period, index) => (
            <PeriodRow
              key={period.id}
              period={period}
              index={index}
              mutations={mutations}
            />
          ))
        )}

        <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثلاً زنگ اول"
            aria-label="نام زنگ"
          />
          <TimeInput
            value={start}
            onChange={setStart}
            className="w-32 shrink-0"
            aria-label="شروع"
          />
          <TimeInput
            value={end}
            onChange={setEnd}
            className="w-32 shrink-0"
            aria-label="پایان"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={mutations.add.isPending}
          >
            {mutations.add.isPending ? "…" : "افزودن"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
