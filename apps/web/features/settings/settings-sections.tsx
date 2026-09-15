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

import { setGradingMode } from "@/features/auth/api"
import {
  addClass,
  addPeriod,
  addSchool,
  addSubject,
  linkSubjectAction,
  removeClass,
  removePeriod,
  removeSchool,
  removeSubject,
  renameClassAction,
  renameSchoolAction,
  renameSubjectAction,
  saveClassSchool,
  savePeriodAction,
  unlinkSubjectAction,
} from "@/features/settings/api"
import { TimeInput } from "@/components/time-input"
import { useSchools } from "@/features/settings/school-options"
import {
  createGradeScale,
  getGradeScale,
  parseGradeValue,
  relabelSubjectGrades,
  saveGradeScale,
} from "@/features/teaching/api"
import {
  useClasses,
  useClassSubjects,
  useGradeScale,
  usePeriodsByClass,
  useSubjects,
} from "@/features/teaching/hooks"
import { ApiError } from "@/lib/api/client"
import { toLatinDigits, toPersianDigits } from "@/lib/date/jalali"
import type { GradeScale, GradingMode, Period } from "@/lib/api/types"
import { useAuthStore } from "@/stores/auth"

// Optimistic writes: the list updates instantly, the server confirms in the
// background. Rollback on error; refetch on settle to swap temp ids.

// ── SHARED ─────────────────────────────────────────────────

type ClassCreateVars = { name: string; schoolId: string }
type NamedMutations = {
  create: ReturnType<
    typeof useMutation<unknown, unknown, string | ClassCreateVars>
  >
  rename: ReturnType<
    typeof useMutation<unknown, unknown, { id: string; name: string }>
  >
  remove: ReturnType<typeof useMutation<unknown, unknown, string>>
  assignSchool?: ReturnType<
    typeof useMutation<unknown, unknown, { id: string; schoolId: string }>
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
  defaultSchoolId,
}: {
  title: string
  placeholder: string
  empty: string
  items: T[] | undefined
  mutations: NamedMutations
  schools?: { id: string; name: string }[]
  schoolOf?: (id: string) => string | null
  onSchool?: (id: string, schoolId: string) => void
  defaultSchoolId?: string | null
}) {
  const [draft, setDraft] = useState("")
  const pending = mutations.create.isPending

  function create(event: React.FormEvent) {
    event.preventDefault()
    const name = draft.trim()
    if (!name) return
    // Classes always belong to a school: fall back to the chosen school when
    // the teacher has exactly one, otherwise ask via the school picker.
    if (defaultSchoolId === undefined) {
      setDraft("")
      mutations.create.mutate(name, { onError: fail })
      return
    }
    if (!defaultSchoolId) {
      toast.error("اول یک مدرسه انتخاب کنید")
      return
    }
    setDraft("")
    mutations.create.mutate(
      { name, schoolId: defaultSchoolId },
      { onError: fail }
    )
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
                  items={schools.map((s) => ({
                    label: s.name,
                    value: s.id,
                  }))}
                  value={schoolOf(item.id)}
                  onValueChange={(v) => v && onSchool(item.id, v)}
                >
                  <SelectTrigger
                    aria-label="مدرسه کلاس"
                    className="max-w-32 shrink-0"
                  >
                    <SelectValue placeholder="مدرسه…" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectLabel>مدرسه</SelectLabel>
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
    mutationFn: (vars: string | ClassCreateVars) =>
      isClass
        ? addClass(
            typeof vars === "string" ? vars : vars.name,
            typeof vars === "string" ? "" : vars.schoolId
          )
        : isSchool
          ? addSchool(typeof vars === "string" ? vars : vars.name)
          : addSubject(typeof vars === "string" ? vars : vars.name),
    onMutate: async (vars) => {
      const previous = await snapshot()
      const now = new Date().toISOString()
      const temp: NamedItem = {
        id: `temp-${now}`,
        name: typeof vars === "string" ? vars : vars.name,
      }
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
    mutationFn: ({ id, schoolId }: { id: string; schoolId: string }) =>
      saveClassSchool(id, schoolId),
    onMutate: async ({ id, schoolId }) => {
      await client.cancelQueries({ queryKey: ["classes"] })
      const previous = client.getQueryData<{ id: string; school_id: string }[]>(
        ["classes"]
      )
      client.setQueryData<{ id: string; school_id: string }[]>(
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
  const [newSchoolId, setNewSchoolId] = useState<string>("")
  // One school → new classes join it silently. Several → teacher picks once
  // below and the picker stays for the next class.
  const defaultSchoolId =
    (schools ?? []).length === 1 ? (schools?.[0]?.id ?? "") : newSchoolId
  return (
    <>
      {(schools ?? []).length > 1 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            مدرسه کلاس جدید:
          </span>
          <Select
            items={(schools ?? []).map((s) => ({ label: s.name, value: s.id }))}
            value={newSchoolId || null}
            onValueChange={(v) => setNewSchoolId(v ?? "")}
          >
            <SelectTrigger className="max-w-48" aria-label="مدرسه کلاس جدید">
              <SelectValue placeholder="انتخاب مدرسه…" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectLabel>مدرسه</SelectLabel>
                {(schools ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
      <NamedSection
        title="کلاس‌ها"
        placeholder="مثلاً هفتم الف"
        empty="هنوز کلاسی اضافه نشده."
        items={classes}
        mutations={mutations}
        schoolOf={(id) => classes?.find((c) => c.id === id)?.school_id ?? null}
        schools={(schools ?? []).map((s) => ({ id: s.id, name: s.name }))}
        defaultSchoolId={defaultSchoolId}
        onSchool={(id, schoolId) =>
          mutations.assignSchool?.mutate({ id, schoolId }, { onError: fail })
        }
      />
    </>
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

// ── GRADING MODE (whole-teacher numeric vs descriptive) ────
// One key for all subjects together. Numeric = 0–20 input, descriptive =
// pick one of the subject scale's 4 levels (no numbers). Old grades convert
// with the switch, then every gradebook refetches.

export function GradingModeSection() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const client = useQueryClient()
  const [saving, setSaving] = useState(false)
  const mode: GradingMode = user?.grading_mode ?? "descriptive"

  async function switchMode(next: GradingMode) {
    if (next === mode) return
    setSaving(true)
    try {
      const { user: saved, converted } = await setGradingMode(next)
      setUser(saved)
      client.setQueryData(["me"], saved)
      await client.invalidateQueries({ queryKey: ["gradebook"] })
      toast.success(
        converted > 0
          ? `متن ${toPersianDigits(converted)} نمره به‌روز شد`
          : "نوع نمره‌دهی تغییر کرد"
      )
    } catch (error) {
      fail(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>نوع نمره‌دهی</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Select
          items={[
            { label: "عددی (۰ تا ۲۰)", value: "numeric" },
            { label: "توصیفی (فقط سطح)", value: "descriptive" },
          ]}
          value={mode}
          onValueChange={(v) =>
            void switchMode((v ?? "descriptive") as GradingMode)
          }
        >
          <SelectTrigger className="w-full" aria-label="نوع نمره‌دهی">
            <SelectValue placeholder="نوع نمره‌دهی…" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              <SelectLabel>نوع نمره‌دهی</SelectLabel>
              <SelectItem value="numeric">عددی (۰ تا ۲۰)</SelectItem>
              <SelectItem value="descriptive">توصیفی (فقط سطح)</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {saving
            ? "در حال تبدیل نمره‌های قبلی…"
            : mode === "descriptive"
              ? "توصیفی: در جدول فقط سطح انتخاب می‌کنید؛ عددی دیده نمی‌شود."
              : "عددی: نمره ۰ تا ۲۰ وارد می‌کنید؛ متن سطح هم زیرش دیده می‌شود."}
        </p>
      </CardContent>
    </Card>
  )
}

// ── GRADE SCALE (per-subject descriptive bands) ────────────
// One scale per subject: 3 cutoffs + 4 names. Saving a scale never rewrites
// old grades; the relabel button does that explicitly, then refreshes grids.

export function GradeScaleSection() {
  const subjects = useSubjects()
  const [picked, setPicked] = useState<string>("")
  // Keep the picker on a subject that still exists after deletes.
  const active = (subjects ?? []).some((s) => s.id === picked)
    ? picked
    : (subjects?.[0]?.id ?? "")
  const scale = useGradeScale(active || null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>سطح‌بندی نمره هر درس</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Select
          items={(subjects ?? []).map((s) => ({ label: s.name, value: s.id }))}
          value={active || null}
          onValueChange={(v) => setPicked(v ?? "")}
        >
          <SelectTrigger className="w-full" aria-label="درس">
            <SelectValue placeholder="درس…" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              <SelectLabel>درس‌ها</SelectLabel>
              {(subjects ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {!active ? (
          <EmptyHint text="اول یک درس بسازید." />
        ) : scale === undefined ? (
          <>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </>
        ) : (
          <ScaleForm key={scale.id} scale={scale} subjectId={active} />
        )}
      </CardContent>
    </Card>
  )
}

function ScaleForm({
  scale,
  subjectId,
}: {
  scale: GradeScale
  subjectId: string
}) {
  const client = useQueryClient()
  const [excellentMin, setExcellentMin] = useState(String(scale.excellent_min))
  const [goodMin, setGoodMin] = useState(String(scale.good_min))
  const [passMin, setPassMin] = useState(String(scale.pass_min))
  const [excellentLabel, setExcellentLabel] = useState(scale.excellent_label)
  const [goodLabel, setGoodLabel] = useState(scale.good_label)
  const [fairLabel, setFairLabel] = useState(scale.fair_label)
  const [needsLabel, setNeedsLabel] = useState(scale.needs_label)
  const [saving, setSaving] = useState(false)
  const [relabeling, setRelabeling] = useState(false)

  const dirty =
    excellentMin !== String(scale.excellent_min) ||
    goodMin !== String(scale.good_min) ||
    passMin !== String(scale.pass_min) ||
    excellentLabel !== scale.excellent_label ||
    goodLabel !== scale.good_label ||
    fairLabel !== scale.fair_label ||
    needsLabel !== scale.needs_label

  async function save() {
    const excellent = parseGradeValue(excellentMin)
    const good = parseGradeValue(goodMin)
    const pass = parseGradeValue(passMin)
    if (excellent === null || good === null || pass === null) {
      toast.error("مرزها باید عدد بین ۰ تا ۲۰ باشند")
      return
    }
    if (!(pass < good && good < excellent)) {
      toast.error("مرزها باید صعودی باشند: قبولی < خوب < خیلی خوب")
      return
    }
    const labels = [excellentLabel, goodLabel, fairLabel, needsLabel].map((l) =>
      l.trim()
    )
    if (labels.some((l) => !l)) {
      toast.error("نام هر چهار سطح لازم است")
      return
    }
    const patch = {
      excellent_min: excellent,
      good_min: good,
      pass_min: pass,
      excellent_label: labels[0] as string,
      good_label: labels[1] as string,
      fair_label: labels[2] as string,
      needs_label: labels[3] as string,
    }
    setSaving(true)
    try {
      // Transient default has a random id: PATCH 404s, then POST creates it.
      // POST 409 means a row already exists: retry the PATCH on its real id.
      const saved = await saveGradeScale(scale.id, patch).catch(
        async (error: unknown) => {
          if (error instanceof ApiError && error.status === 404)
            return createGradeScale(subjectId, patch).catch(
              async (retryError: unknown) => {
                // Two tabs saved at once: the loser re-reads the winner's row.
                if (
                  retryError instanceof ApiError &&
                  retryError.status === 409
                ) {
                  const fresh = await getGradeScale(subjectId)
                  return saveGradeScale(fresh.id, patch)
                }
                throw retryError
              }
            )
          throw error
        }
      )
      client.setQueryData(["grade-scale", subjectId], saved)
      toast.success("سطح‌بندی ذخیره شد")
    } catch (error) {
      fail(error)
    } finally {
      setSaving(false)
    }
  }

  async function relabel() {
    setRelabeling(true)
    try {
      const count = await relabelSubjectGrades(subjectId)
      // Stored labels changed server-side: every grid of this subject refetches.
      await client.invalidateQueries({ queryKey: ["gradebook"] })
      toast.success(
        count > 0
          ? `متن ${toPersianDigits(count)} نمره به‌روز شد`
          : "نمره‌ای برای به‌روزرسانی نیست"
      )
    } catch (error) {
      fail(error)
    } finally {
      setRelabeling(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">مرز خیلی خوب (از)</span>
          <Input
            value={excellentMin}
            onChange={(e) => setExcellentMin(toLatinDigits(e.target.value))}
            inputMode="decimal"
            aria-label="مرز خیلی خوب"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">مرز خوب (از)</span>
          <Input
            value={goodMin}
            onChange={(e) => setGoodMin(toLatinDigits(e.target.value))}
            inputMode="decimal"
            aria-label="مرز خوب"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">مرز قبولی (از)</span>
          <Input
            value={passMin}
            onChange={(e) => setPassMin(toLatinDigits(e.target.value))}
            inputMode="decimal"
            aria-label="مرز قبولی"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">نام سطح اول</span>
          <Input
            value={excellentLabel}
            onChange={(e) => setExcellentLabel(e.target.value)}
            aria-label="نام سطح اول"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">نام سطح دوم</span>
          <Input
            value={goodLabel}
            onChange={(e) => setGoodLabel(e.target.value)}
            aria-label="نام سطح دوم"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">نام سطح سوم</span>
          <Input
            value={fairLabel}
            onChange={(e) => setFairLabel(e.target.value)}
            aria-label="نام سطح سوم"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">نام سطح چهارم</span>
          <Input
            value={needsLabel}
            onChange={(e) => setNeedsLabel(e.target.value)}
            aria-label="نام سطح چهارم"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        نمره‌های قبلی متن قدیمی را نگه می‌دارند؛ برای اعمال سطح جدید روی آن‌ها
        «اعمال روی نمره‌های موجود» را بزنید.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
        >
          {saving ? "…" : "ذخیره"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={relabeling}
          onClick={() => void relabel()}
        >
          {relabeling ? "…" : "اعمال روی نمره‌های موجود"}
        </Button>
      </div>
    </div>
  )
}

export function ClassSubjectsSection() {
  const client = useQueryClient()
  const classes = useClasses()
  const subjects = useSubjects()
  const [classId, setClassId] = useState<string>("")
  const links = useClassSubjects(classId || null)
  const linkedIds = new Set((links ?? []).map((l) => l.subject_id))

  function toggle(subjectId: string, on: boolean) {
    const link = (links ?? []).find((l) => l.subject_id === subjectId)
    const done = () =>
      client.invalidateQueries({ queryKey: ["class-subjects", classId] })
    if (on && !link) {
      linkSubjectAction(classId, subjectId).then(done, fail)
    } else if (!on && link) {
      unlinkSubjectAction(link.id).then(done, fail)
    }
  }

  if (!classes?.length || !subjects?.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>درس‌های هر کلاس</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
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
        {classId &&
          (subjects ?? []).map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={linkedIds.has(s.id)}
                onChange={(e) => toggle(s.id, e.target.checked)}
                className="size-4 accent-primary"
              />
              {s.name}
            </label>
          ))}
      </CardContent>
    </Card>
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

// Bells live under one class: every mutation targets ["periods", classId]
// so the dialog's usePeriodsByClass and the global useLookups stay in sync.
function usePeriodMutations(classId: string) {
  const client = useQueryClient()
  const key = ["periods", classId] as const

  async function snapshot() {
    await client.cancelQueries({ queryKey: key })
    return client.getQueryData<Period[]>(key)
  }

  /** Mirror an edit into the global list cache too (day/week lookups). */
  function syncGlobal(saved: Period) {
    client.setQueryData<Period[]>(["periods"], (old) =>
      old?.map((p) => (p.id === saved.id ? saved : p))
    )
  }

  function dropGlobal(id: string) {
    client.setQueryData<Period[]>(["periods"], (old) =>
      old?.filter((p) => p.id !== id)
    )
  }

  const save = useMutation({
    mutationFn: ({ id, label, start, end, order_index }: PeriodPatch) =>
      savePeriodAction(id, {
        class_id: classId,
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
      syncGlobal(saved)
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
        classId,
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
        class_id: classId,
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
      client.setQueryData<Period[]>(["periods"], (old) => [
        ...(old ?? []),
        saved,
      ])
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
    onSuccess: (_v, id) => dropGlobal(id),
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
  const classes = useClasses()
  const [classId, setClassId] = useState<string>("")
  // Keep the picker on a class that still exists after deletes.
  const activeClassId = (classes ?? []).some((c) => c.id === classId)
    ? classId
    : (classes?.[0]?.id ?? "")
  const periods = usePeriodsByClass(activeClassId || null)
  const mutations = usePeriodMutations(activeClassId)
  const [label, setLabel] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!activeClassId) {
      toast.error("اول یک کلاس بسازید")
      return
    }
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
        <CardTitle>زنگ‌های هر کلاس</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Select
          items={(classes ?? []).map((c) => ({ label: c.name, value: c.id }))}
          value={activeClassId || null}
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
        {!activeClassId ? (
          <EmptyHint text="اول یک کلاس بسازید." />
        ) : periods === undefined ? (
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
