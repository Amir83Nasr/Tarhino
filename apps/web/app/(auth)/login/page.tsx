"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { AuthForm } from "@/features/auth/auth-form"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden rounded-3xl bg-muted lg:m-4 lg:block">
        <div className="relative size-full">
          <Image
            src="/images/login-image.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
        </div>
      </div>
      <div className="relative flex flex-col items-center justify-center p-6 md:p-10">
        <div className="inset-e-6 absolute top-6">
          <Button variant="outline" size="xs" asChild>
            <Link href="/">
              <ArrowRight className="me-1.5 size-4" aria-hidden="true" />
              بازگشت به صفحه اصلی
            </Link>
          </Button>
        </div>
        <div className="flex w-full max-w-xs flex-col justify-center">
          <AuthForm />
        </div>
      </div>
    </div>
  )
}
