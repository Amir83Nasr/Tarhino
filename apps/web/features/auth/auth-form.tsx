"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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

  // Users type Persian digits or a +98/0098 prefix; the API wants 09xxxxxxxxx.
  const normalizePhone = (value: string) =>
    toLatinDigits(value)
      .replace(/^(?:\+|00)?98/, "0")
      .replace(/\D/g, "")
  const normalizedPhone = normalizePhone(phone)

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
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">ورود به طرحینو</h1>
          <FieldDescription>
            {step === "phone"
              ? "برای ورود یا ساخت حساب، شماره موبایل خود را وارد کنید."
              : step === "login"
                ? "این شماره ثبت شده است. برای ورود گذرواژه را وارد کنید."
                : "این شماره ثبت نشده است. برای ساخت حساب نام و گذرواژه را وارد کنید."}
          </FieldDescription>
        </div>

        <Field>
          {step === "phone" ? (
            <>
              <FieldLabel htmlFor="phone">شماره موبایل</FieldLabel>
              <Input
                id="phone"
                inputMode="tel"
                dir="ltr"
                autoComplete="tel"
                placeholder="09123456789"
                value={normalizedPhone}
                onChange={(e) => setPhone(normalizePhone(e.target.value))}
                autoFocus
              />
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span dir="ltr" className="text-sm font-medium">
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
        </Field>

        {step === "register" && (
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="first_name">نام</FieldLabel>
              <Input
                id="first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="last_name">نام خانوادگی</FieldLabel>
              <Input
                id="last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
        )}

        {step !== "phone" && (
          <Field>
            <FieldLabel htmlFor="password">گذرواژه</FieldLabel>
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
          </Field>
        )}

        <Field>
          <Button type="submit" disabled={pending}>
            {pending
              ? "لطفاً صبر کنید…"
              : step === "phone"
                ? "ادامه"
                : step === "login"
                  ? "ورود"
                  : "ثبت‌نام و ورود"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
