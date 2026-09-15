"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { TimeInput } from "@/components/time-input"
import { StudentsSection } from "@/features/grades/students-section"
import {
  listSchools,
  savePeriod,
  setupElementaryClass,
  type PeriodInput,
} from "@/features/teaching/api"
import type { Period, School, Subject, TeachingClass } from "@/lib/api/types"
import { useClasses, usePeriodsByClass } from "@/features/teaching/hooks"
import {
  DEFAULT_CLASS_NAME,
  ELEMENTARY_GRADES,
  SHIFT_HINT,
  SHIFT_LABEL,
  type ElementaryGrade,
  type Shift,
} from "@/features/settings/elementary-presets"
import { ApiError } from "@/lib/api/client"

// Single setup form for an elementary teacher: school name, grade, class
// name, shift (fixed or auto-rotating), the 5 editable bells, students.

function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "ذخیره نشد")
}

const BELL_ORDER = ["زنگ اول", "زنگ دوم", "زنگ سوم", "زنگ چهارم", "زنگ پنجم"]

export function ElementarySetupSection() {
  const classes = useClasses()
  const client = useQueryClient()
  const single = classes?.[0] ?? null

  const [schoolName, setSchoolName] = useState("")
  const [grade, setGrade] = useState<ElementaryGrade | "">("")
  const [className, setClassName] = useState("")
  const [shift, setShift] = useState<Shift>("morning")
  const [busy, setBusy] = useState(false)

  // Seed the form from the saved class during render (idempotent: same
  // key writes the same values, so no render loop and no seeded flag).
  const seedKey = single
    ? `${single.name}:${single.grade ?? ""}:${single.shift}`
    : null
  const [lastSeed, setLastSeed] = useState<string | null>(null)
  if (seedKey && seedKey !== lastSeed) {
    setLastSeed(seedKey)
    setSchoolName("")
    setGrade(
      (ELEMENTARY_GRADES as readonly string[]).includes(single!.grade ?? "")
        ? (single!.grade as ElementaryGrade)
        : ""
    )
    setClassName(single!.name)
    setShift(single!.shift)
  }

  // School name arrives from the server, not from [classes].
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: listSchools,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })
  const school = schools?.[0] ?? client.getQueryData<School>(["my-school"])

  const editingGrade: ElementaryGrade | "" =
    grade || (single?.grade as ElementaryGrade) || ""

  async function submit() {
    const name = schoolName.trim() || school?.name.trim() || ""
    if (!name) {
      toast.error("نام مدرسه را بنویسید")
      return
    }
    if (!editingGrade) {
      toast.error("اول پایه را انتخاب کنید")
      return
    }
    setBusy(true)
    try {
      const saved = await setupElementaryClass({
        school_name: name,
        name: className.trim() || undefined,
        grade: editingGrade,
        shift,
      })
      client.setQueryData<TeachingClass[]>(["classes"], [saved])
      client.setQueryData<School>(["my-school"], saved.school)
      client.setQueryData<Subject[]>(["subjects"], saved.subjects)
      client.setQueryData(["periods", saved.id], saved.periods)
      await client.invalidateQueries({ queryKey: ["periods"] })
      await client.invalidateQueries({ queryKey: ["class-subjects"] })
      setSchoolName(saved.school.name)
      setGrade(saved.grade as ElementaryGrade)
      setClassName(saved.name)
      setShift(saved.shift)
      toast.success(`کلاس ${saved.name} آماده شد`)
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  const items = (Object.keys(SHIFT_LABEL) as Shift[]).map((s) => ({
    label: `شیفت ${SHIFT_LABEL[s]} — ${SHIFT_HINT[s]}`,
    value: s,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>کلاس من</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {classes === undefined ? (
          <>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="school-name">نام مدرسه</Label>
              <Input
                id="school-name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder={school?.name || "مثلاً دبستان قیام"}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>پایه</Label>
                <Select
                  items={ELEMENTARY_GRADES.map((g) => ({
                    label: g,
                    value: g,
                  }))}
                  value={editingGrade || null}
                  onValueChange={(v) => {
                    const next = (v as ElementaryGrade) ?? ""
                    setGrade(next)
                    if (next && !className.trim())
                      setClassName(DEFAULT_CLASS_NAME[next])
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="پایه">
                    <SelectValue placeholder="پایه…" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectLabel>پایه</SelectLabel>
                      {ELEMENTARY_GRADES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="class-name">نام کلاس</Label>
                <Input
                  id="class-name"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder={
                    editingGrade
                      ? DEFAULT_CLASS_NAME[editingGrade]
                      : "مثلاً اول الف"
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>شیفت</Label>
              <Select
                items={items}
                value={shift}
                onValueChange={(v) => setShift((v as Shift) ?? "morning")}
              >
                <SelectTrigger className="w-full" aria-label="شیفت">
                  <SelectValue placeholder="شیفت…" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectLabel>شیفت</SelectLabel>
                    {(Object.keys(SHIFT_LABEL) as Shift[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        شیفت {SHIFT_LABEL[s]} — {SHIFT_HINT[s]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button
                type="button"
                disabled={busy || !editingGrade}
                onClick={() => void submit()}
              >
                {busy ? "…" : single ? "ذخیره" : "ساخت کلاس"}
              </Button>
            </div>

            {single ? (
              <BellsEditor classId={single.id} shift={shift} />
            ) : (
              <p className="text-xs text-muted-foreground">
                با ساخت کلاس، درس‌های پایه و ۱۰ زنگ (۵ صبح + ۵ ظهر) آماده
                می‌شود؛ ساعت‌ها را همین‌جا ویرایش کنید.
              </p>
            )}

            {single ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">دانش‌آموزان</h3>
                <StudentsSection key={single.id} classId={single.id} bare />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── BELLS (5 per shift set, times editable) ───────────────
// Fixed shifts show their own 5; rotating shows both sets under tabs so the
// teacher can edit each week's hours.

function BellsEditor({ classId, shift }: { classId: string; shift: Shift }) {
  const periods = usePeriodsByClass(classId)
  const [tab, setTab] = useState<"morning" | "afternoon">("morning")
  const visible: "morning" | "afternoon" = shift === "rotating" ? tab : shift

  if (periods === undefined) {
    return (
      <>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </>
    )
  }

  const rows = BELL_ORDER.map((label, order) =>
    periods.find((p) => p.shift === visible && p.order_index === order)
  )

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">ساعت زنگ‌ها</h3>
      {shift === "rotating" ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="morning">صبح</TabsTrigger>
            <TabsTrigger value="afternoon">ظهر</TabsTrigger>
          </TabsList>
          <TabsContent value="morning" className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <BellRow
                key={`${visible}:${i}`}
                classId={classId}
                bellShift={visible}
                order={i}
                label={BELL_ORDER[i]!}
                period={row ?? null}
              />
            ))}
          </TabsContent>
          <TabsContent value="afternoon" className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <BellRow
                key={`${visible}:${i}`}
                classId={classId}
                bellShift={visible}
                order={i}
                label={BELL_ORDER[i]!}
                period={row ?? null}
              />
            ))}
          </TabsContent>
        </Tabs>
      ) : (
        rows.map((row, i) => (
          <BellRow
            key={`${visible}:${i}`}
            classId={classId}
            bellShift={visible}
            order={i}
            label={BELL_ORDER[i]!}
            period={row ?? null}
          />
        ))
      )}
    </div>
  )
}

function BellRow({
  classId,
  bellShift,
  order,
  label,
  period,
}: {
  classId: string
  bellShift: "morning" | "afternoon"
  order: number
  label: string
  period: Period | null
}) {
  const client = useQueryClient()
  const [start, setStart] = useState(period?.start_time.slice(0, 5) ?? "")
  const [end, setEnd] = useState(period?.end_time.slice(0, 5) ?? "")
  const [busy, setBusy] = useState(false)

  const savedStart = period?.start_time.slice(0, 5) ?? ""
  const savedEnd = period?.end_time.slice(0, 5) ?? ""
  const dirty = start !== savedStart || end !== savedEnd

  function patch(saved: Period) {
    client.setQueryData<Period[]>(["periods", classId], (old) =>
      old?.map((p) => (p.id === saved.id ? saved : p))
    )
    client.setQueryData<Period[]>(["periods"], (old) =>
      old?.map((p) => (p.id === saved.id ? saved : p))
    )
  }

  async function save() {
    if (!start || !end) {
      toast.error("ساعت شروع و پایان را کامل کنید")
      return
    }
    if (end <= start) {
      toast.error("ساعت پایان باید بعد از شروع باشد")
      return
    }
    if (!period) return
    setBusy(true)
    try {
      const input: PeriodInput = {
        class_id: classId,
        label,
        start_time: start,
        end_time: end,
        order_index: order,
        shift: bellShift,
      }
      const saved = await savePeriod(period.id, input)
      patch(saved)
      toast.success("ساعت زنگ ذخیره شد")
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 shrink-0 text-[13px]">{label}</span>
      <TimeInput
        value={start}
        onChange={setStart}
        className="w-18 shrink-0 px-2 text-center"
        aria-label={`شروع ${label}`}
      />
      <TimeInput
        value={end}
        onChange={setEnd}
        className="w-18 shrink-0 px-2 text-center"
        aria-label={`پایان ${label}`}
      />
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={!dirty || busy || !period}
        onClick={() => void save()}
      >
        {busy ? "…" : "ذخیره"}
      </Button>
    </div>
  )
}
