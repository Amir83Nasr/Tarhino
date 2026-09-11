import Image from "next/image"

import loginImage from "@/public/login-image.jpg"
import { AuthForm } from "@/features/auth/auth-form"

export const metadata = { title: "ورود | طرحینو" }

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
            src={loginImage}
            alt=""
            fill
            priority
            className="object-cover"
          />
        </div>
      </div>
    </div>
  )
}
