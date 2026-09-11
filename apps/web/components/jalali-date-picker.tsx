"use client"

import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { CalendarIcon } from "lucide-react"

import {
  formatNumericDate,
  fromISODate,
  toISODate,
  today,
} from "@/lib/date/jalali"

// Jalali single-date picker. The value is the ISO Gregorian string used
// everywhere else in the app; only what the teacher sees is Shamsi.

type Props = {
  value: string | null
  onChange: (isoDate: string | null) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}

export function JalaliDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  ariaLabel,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const selected = value ? fromISODate(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={ariaLabel}
            className={className}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {selected ? (
          formatNumericDate(selected)
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? today()}
          onSelect={(date) => {
            onChange(date ? toISODate(date) : null)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
