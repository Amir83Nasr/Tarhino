"use client"

import { Bell, CircleCheck, School, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import { useClasses, usePeriods } from "@/features/teaching/hooks"
import { useStudents } from "@/features/grades/hooks"
import { toPersianDigits } from "@/lib/date/jalali"

// Shows until class + bells + students all exist. Landing page after login is
// /week, so the banner lives in AppShell: visible on every page (except
// settings itself) until the base data is complete.
export function OnboardingGuide() {
  const pathname = usePathname()
  const classes = useClasses()
  const periods = usePeriods()
  const singleClassId = classes?.[0]?.id ?? null
  const students = useStudents(singleClassId)

  if (pathname.startsWith("/settings")) return null
  if (classes === undefined || periods === undefined || students === undefined)
    return null

  const steps = [
    {
      icon: School,
      title: "کلاس",
      hint: "نام مدرسه، پایه و شیفت",
      done: classes.length > 0,
    },
    {
      icon: Bell,
      title: "زنگ",
      hint: "ساعت شروع و پایان هر زنگ",
      done: periods.length > 0,
    },
    {
      icon: Users,
      title: "دانش‌آموز",
      hint: "فهرست کلاس",
      done: students.length > 0,
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  return (
    <div className="mx-auto mb-4 w-full max-w-6xl">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle>اول اطلاعات پایه را کامل کن</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            برای ساخت طرح درس و کارنامه اول این {toPersianDigits(steps.length)}{" "}
            مورد لازم است ({toPersianDigits(doneCount)} از{" "}
            {toPersianDigits(steps.length)} آماده).
          </p>
          <ul className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                  step.done
                    ? "border-transparent text-muted-foreground"
                    : "border-foreground/10 bg-card"
                )}
              >
                {step.done ? (
                  <CircleCheck className="size-5 shrink-0 text-primary" />
                ) : (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
                    {toPersianDigits(i + 1)}
                  </span>
                )}
                <step.icon className="size-4 shrink-0" />
                <span className="font-medium">{step.title}</span>
                <span className="text-xs text-muted-foreground">
                  {step.hint}
                </span>
              </li>
            ))}
          </ul>
          <div>
            <Button asChild size="default">
              <Link href="/settings">رفتن به تنظیمات</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
