"use client"

import { Undo2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="mx-auto flex min-h-[70svh] w-full max-w-md flex-col items-center justify-center gap-5 px-4 py-10 text-center">
      <Image src="/icons/square.svg" alt="طرحینو" width={64} height={64} />
      <p
        dir="ltr"
        aria-hidden
        className="text-7xl font-bold tracking-tight text-primary tabular-nums"
      >
        ۴۰۴
      </p>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-bold">این صفحه پیدا نشد</h1>
        <p className="text-sm text-muted-foreground">
          آدرس اشتباه است یا صفحه جابه‌جا شده. برگردیم سر کلاس؟
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/week" replace className={cn(buttonVariants())}>
          بازگشت به طرح درس
        </Link>
        <Button variant="outline" onClick={() => router.back()}>
          <Undo2 />
          صفحه قبلی
        </Button>
      </div>
    </div>
  )
}
