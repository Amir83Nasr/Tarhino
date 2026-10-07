"use client"

import { FileDown } from "lucide-react"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

// One PDF button for every teacher page: same label, size, busy text.
// ponytail: single-file download only. Upgrade: share-sheet target picker.
export function PdfButton({
  label,
  disabled,
  run,
  done = "فایل پی‌دی‌اف ذخیره شد",
}: {
  label: string
  disabled?: boolean
  run: () => Promise<void>
  done?: string
}) {
  const [busy, setBusy] = useState(false)
  async function onClick() {
    setBusy(true)
    try {
      await run()
      toast.success(done)
    } catch {
      toast.error("دانلود انجام نشد")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={disabled || busy}
      onClick={() => void onClick()}
    >
      <FileDown />
      {busy ? "در حال ساخت…" : label}
    </Button>
  )
}
