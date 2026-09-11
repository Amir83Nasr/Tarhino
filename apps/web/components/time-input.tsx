"use client"

import { useState } from "react"

import { Input } from "@workspace/ui/components/input"

import { toLatinDigits, toPersianDigits } from "@/lib/date/jalali"

// Time input بومی (type="time") در iOS همیشه ۱۲ساعته (AM/PM) با استایل
// سیستم‌عامل رندر می‌شود؛ پس اینپوت متنی با ماسک HH:MM است تا نمایش همیشه
// ۲۴ساعته و استایل دقیقاً مشابه بقیه اینپوت‌ها بماند.

// ponytail: ویرایش وسط متن کرسر را به انتها می‌برد؛ اگر مهم شد ماسک را با
// نگهداری موقعیت کرسر بازنویسی کن.

function mask(raw: string): string {
  const digits = toLatinDigits(raw).replace(/\D/g, "").slice(0, 4)
  return digits.length <= 2
    ? digits
    : `${digits.slice(0, 2)}:${digits.slice(2)}`
}

function normalize(masked: string): string {
  if (!masked) return ""
  const [h = "", m = ""] = masked.split(":")
  const hour = String(Math.min(23, Number(h) || 0)).padStart(2, "0")
  const minute = String(Math.min(59, Number(m || "0") || 0)).padStart(2, "0")
  return `${hour}:${minute}`
}

type Props = {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  placeholder?: string
  "aria-label"?: string
}

export function TimeInput({
  value,
  onChange,
  id,
  className,
  placeholder = "۰۰:۰۰",
  "aria-label": ariaLabel,
}: Props) {
  // والد فقط مقدار کامل HH:MM (یا خالی) می‌گیرد تا مقایسه‌های رشته‌ای
  // موجود (end <= start) با مقدار ناقص حین تایپ نشکنند؛ draft محلی حین
  // تایپ نگه داشته می‌شود و با تغییر بیرونی value (مثلاً انتخاب زنگ)
  // حین رندر همگام می‌شود.
  const [draft, setDraft] = useState(toPersianDigits(value))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(toPersianDigits(value))
  }

  return (
    <Input
      id={id}
      dir="ltr"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      value={draft}
      onChange={(e) => {
        const masked = mask(e.target.value)
        setDraft(toPersianDigits(masked))
        if (masked === "" || masked.length === 5) {
          onChange(normalize(masked))
        }
      }}
      onBlur={(e) => {
        const full = normalize(mask(e.target.value))
        setDraft(toPersianDigits(full))
        if (full !== value) onChange(full)
      }}
    />
  )
}
