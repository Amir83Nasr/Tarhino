"use client"

import { RotateCcw } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect } from "react"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[70svh] w-full max-w-md flex-col items-center justify-center gap-5 px-4 py-10 text-center">
      <Image src="/icons/square.svg" alt="طرحینو" width={64} height={64} />
      <p
        aria-hidden
        className="text-7xl font-bold tracking-tight text-primary tabular-nums"
      >
        ۵۰۰
      </p>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-bold">مشکلی پیش آمد</h1>
        <p className="text-sm text-muted-foreground">
          صفحه باز نشد. یک بار دیگر تلاش کنید؛ اگر درست نشد، به طرح درس برگردید.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={() => reset()}>
          <RotateCcw />
          تلاش دوباره
        </Button>
        <Link
          href="/week"
          replace
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          بازگشت به طرح درس
        </Link>
      </div>
    </div>
  )
}
