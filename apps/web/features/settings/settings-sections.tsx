"use client"

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
import { toast } from "@workspace/ui/components/sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import {
  addClass,
  addPeriod,
  addSubject,
  removeClass,
  removePeriod,
  removeSubject,
  renameClass,
  renameSubject,
  savePeriod,
} from "@/features/settings/local-actions"
import { useClasses, usePeriods, useSubjects } from "@/features/teaching/hooks"
import type { Period } from "@/lib/api/types"

// Writes go to Dexie and the sync queue; the UI updates from the live query, so
// there is no cache to invalidate and no pending state worth showing.

// ── SHARED ─────────────────────────────────────────────────

type NamedApi = {
  create: (name: string) => Promise<unknown>
  rename: (id: string, name: string) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
}

function DeleteButton({ onClick }: { onClick: () => void }) {
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

function fail(error: unknown) {
  toast.error(error instanceof Error ? error.message : "ذخیره نشد")
}

// ── NAMED LISTS (CLASSES / SUBJECTS) ───────────────────────

function NamedSection<T extends { id: string; name: string }>({
  title,
  placeholder,
  items,
  api,
}: {
  title: string
  placeholder: string
  items: T[]
  api: NamedApi
}) {
  const [draft, setDraft] = useState("")

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
    } catch (error) {
      fail(error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input
              defaultValue={item.name}
              onBlur={(e) => {
                const name = e.target.value.trim()
                if (name && name !== item.name)
                  void run(() => api.rename(item.id, name))
                else e.target.value = item.name
              }}
            />
            <DeleteButton onClick={() => void run(() => api.remove(item.id))} />
          </div>
        ))}

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const name = draft.trim()
            if (!name) return
            setDraft("")
            void run(() => api.create(name))
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
          />
          <Button type="submit" variant="outline" size="sm">
            افزودن
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function ClassesSection() {
  const classes = useClasses()
  return (
    <NamedSection
      title="کلاس‌ها"
      placeholder="مثلاً هفتم الف"
      items={classes ?? []}
      api={{ create: addClass, rename: renameClass, remove: removeClass }}
    />
  )
}

export function SubjectsSection() {
  const subjects = useSubjects()
  return (
    <NamedSection
      title="درس‌ها"
      placeholder="مثلاً ریاضی"
      items={subjects ?? []}
      api={{ create: addSubject, rename: renameSubject, remove: removeSubject }}
    />
  )
}

// ── PERIODS ────────────────────────────────────────────────

const toInput = (time: string) => time.slice(0, 5)

function PeriodRow({ period, index }: { period: Period; index: number }) {
  const [label, setLabel] = useState(period.label)
  const [start, setStart] = useState(toInput(period.start_time))
  const [end, setEnd] = useState(toInput(period.end_time))

  const dirty =
    label !== period.label ||
    start !== toInput(period.start_time) ||
    end !== toInput(period.end_time)

  async function save() {
    if (end <= start) {
      toast.error("ساعت پایان باید بعد از شروع باشد")
      return
    }
    try {
      await savePeriod(period.id, {
        label,
        start_time: start,
        end_time: end,
        order_index: index,
      })
    } catch (error) {
      fail(error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label="نام زنگ"
      />
      <Input
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="w-24"
        aria-label="شروع"
      />
      <Input
        type="time"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className="w-24"
        aria-label="پایان"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!dirty}
        onClick={save}
      >
        ذخیره
      </Button>
      <DeleteButton onClick={() => void removePeriod(period.id).catch(fail)} />
    </div>
  )
}

export function PeriodsSection() {
  const periods = usePeriods()
  const [label, setLabel] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!label.trim() || !start || !end) {
      toast.error("نام و ساعت زنگ را کامل کنید")
      return
    }
    if (end <= start) {
      toast.error("ساعت پایان باید بعد از شروع باشد")
      return
    }
    try {
      await addPeriod(label.trim(), start, end)
      setLabel("")
      setStart("")
      setEnd("")
    } catch (error) {
      fail(error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>زنگ‌ها</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {periods?.map((period, index) => (
          <PeriodRow key={period.id} period={period} index={index} />
        ))}

        <form className="flex items-center gap-2" onSubmit={submit}>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثلاً زنگ اول"
            aria-label="نام زنگ"
          />
          <Input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-24"
            aria-label="شروع"
          />
          <Input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-24"
            aria-label="پایان"
          />
          <Button type="submit" variant="outline" size="sm">
            افزودن
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
