"use client"

import { useLiveQuery } from "dexie-react-hooks"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import {
  discardLocalClass,
  discardLocalPeriod,
  discardLocalPlan,
  discardLocalSubject,
  keepLocalClass,
  keepLocalPeriod,
  keepLocalPlan,
  keepLocalSubject,
} from "@/features/settings/local-actions"
import { db } from "@/db"
import { formatNumericDate, fromISODate } from "@/lib/date/jalali"

// A conflict means another device saved the same row first. The user picks which
// version survives; nothing is resolved silently.

type Conflict = {
  id: string
  label: string
  keep: () => Promise<void>
  discard: () => Promise<void>
}

export function ConflictsSection() {
  const conflicts = useLiveQuery(async (): Promise<Conflict[]> => {
    const [classes, subjects, periods, plans] = await Promise.all([
      db.classes.where("sync_status").equals("conflict").toArray(),
      db.subjects.where("sync_status").equals("conflict").toArray(),
      db.periods.where("sync_status").equals("conflict").toArray(),
      db.lesson_plans.where("sync_status").equals("conflict").toArray(),
    ])

    return [
      ...classes.map((c) => ({
        id: c.id,
        label: `کلاس: ${c.name}`,
        keep: () => keepLocalClass(c.id),
        discard: () => discardLocalClass(c.id),
      })),
      ...subjects.map((s) => ({
        id: s.id,
        label: `درس: ${s.name}`,
        keep: () => keepLocalSubject(s.id),
        discard: () => discardLocalSubject(s.id),
      })),
      ...periods.map((p) => ({
        id: p.id,
        label: `زنگ: ${p.label}`,
        keep: () => keepLocalPeriod(p.id),
        discard: () => discardLocalPeriod(p.id),
      })),
      ...plans.map((p) => ({
        id: p.id,
        label: `درس روز ${formatNumericDate(fromISODate(p.date))}`,
        keep: () => keepLocalPlan(p.id),
        discard: () => discardLocalPlan(p.id),
      })),
    ]
  }, [])

  if (!conflicts?.length) return null

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle>تعارض‌های همگام‌سازی</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          این موارد روی دستگاه دیگری تغییر کرده‌اند. کدام نسخه بماند؟
        </p>
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0"
          >
            <span className="text-sm">{conflict.label}</span>
            <div className="flex gap-2">
              <Button onClick={() => void conflict.keep()}>نسخه من</Button>
              <Button variant="outline" onClick={() => void conflict.discard()}>
                نسخه سرور
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
