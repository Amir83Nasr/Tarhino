"use client"

import Image from "next/image"

import { AuthForm } from "@/features/auth/auth-form"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-5">
      <div className="flex flex-col p-6 md:p-10 lg:col-span-2">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <AuthForm />
          </div>
        </div>
      </div>
      <div className="hidden p-4 lg:col-span-3 lg:block">
        <div className="relative h-full overflow-hidden rounded-2xl">
          <Image
            src="/login-image.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </div>
  )
}
