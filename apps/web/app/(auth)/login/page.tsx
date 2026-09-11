import Image from "next/image"

import loginImage from "@/public/login-image.png"
import { AuthForm } from "@/features/auth/auth-form"

export const metadata = { title: "ورود | طرحینو" }

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <AuthForm />
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <Image src={loginImage} alt="" fill priority className="object-cover" />
      </div>
    </div>
  )
}
