"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { toast } from "@workspace/ui/components/sonner"

import { checkPhone, login, register } from "@/features/auth/api"
import { toLatinDigits } from "@/lib/date/jalali"
import { useAuthStore } from "@/stores/auth"

type Step = "phone" | "login" | "register"

export function AuthForm() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)

  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [password, setPassword] = useState("")

  // Users type Persian digits; the API wants Latin.
  const normalizedPhone = toLatinDigits(phone).replace(/\D/g, "")

  const resolvePhone = useMutation({
    mutationFn: () => checkPhone(normalizedPhone),
    onSuccess: (exists) => {
      setPassword("")
      setStep(exists ? "login" : "register")
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "خطا در ارتباط با سرور"
      ),
  })

  const submit = useMutation({
    mutationFn: async () => {
      if (step === "register") {
        await register({
          phone: normalizedPhone,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          password,
        })
      }
      // Registration does not sign in; log in with the same credentials.
      const result = await login(normalizedPhone, password)
      return result.user
    },
    onSuccess: (user) => {
      setUser(user)
      router.replace("/today")
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "ورود ناموفق بود"),
  })

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (step === "phone") resolvePhone.mutate()
    else submit.mutate()
  }

  const pending = resolvePhone.isPending || submit.isPending

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">شماره موبایل</Label>
        {step === "phone" ? (
          <Input
            id="phone"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder="09123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
          />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span dir="ltr" className="text-sm">
              {normalizedPhone}
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => setStep("phone")}
            >
              ویرایش شماره
            </Button>
          </div>
        )}
      </div>

      {step !== "phone" && (
        <p className="text-sm text-muted-foreground">
          {step === "login"
            ? "این شماره ثبت شده است. برای ورود گذرواژه را وارد کنید."
            : "این شماره ثبت نشده است. برای ساخت حساب نام و گذرواژه را وارد کنید."}
        </p>
      )}

      {step === "register" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="first_name">نام</Label>
            <Input
              id="first_name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="last_name">نام خانوادگی</Label>
            <Input
              id="last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
      )}

      {step !== "phone" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">گذرواژه</Label>
          <Input
            id="password"
            type="password"
            dir="ltr"
            autoComplete={
              step === "login" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
      )}

      <Button type="submit" disabled={pending} className="mt-2">
        {pending
          ? "لطفاً صبر کنید…"
          : step === "phone"
            ? "ادامه"
            : step === "login"
              ? "ورود"
              : "ثبت‌نام و ورود"}
      </Button>
    </form>
  )
}
