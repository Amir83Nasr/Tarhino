"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
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

import { ApiError } from "@/lib/api/client"
import { checkPhone, login, register } from "@/features/auth/api"
import { listClasses, listPeriods, listSubjects } from "@/features/teaching/api"
import { toLatinDigits } from "@/lib/date/jalali"
import { useAuthStore } from "@/stores/auth"

// Same 10-min lookup cache as hooks.ts: the week page reads these keys first,
// so a warm cache means no loading state after login.
const LOOKUP_PREFETCH = {
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
} as const

type Step = "phone" | "login" | "register"

export function AuthForm() {
  const router = useRouter()
  const client = useQueryClient()
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
      // ApiError messages are Persian (translated in client.ts); anything else
      // (browser/network internals) must not leak English into the toast.
      toast.error(
        error instanceof ApiError ? error.message : "خطا در ارتباط با سرور"
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
      // Warm the week page before navigating: route JS + the lookups it
      // reads first, so it renders full instead of skeleton-by-skeleton.
      router.prefetch("/week")
      void client.prefetchQuery({
        queryKey: ["classes"],
        queryFn: listClasses,
        ...LOOKUP_PREFETCH,
      })
      void client.prefetchQuery({
        queryKey: ["subjects"],
        queryFn: listSubjects,
        ...LOOKUP_PREFETCH,
      })
      void client.prefetchQuery({
        queryKey: ["periods"],
        queryFn: listPeriods,
        ...LOOKUP_PREFETCH,
      })
      router.replace("/week")
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "ورود ناموفق بود"
      ),
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
