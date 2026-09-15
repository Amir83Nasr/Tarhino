"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "@workspace/ui/components/sonner"

import { changePassword, updateMe } from "@/features/auth/api"
import { ApiError } from "@/lib/api/client"
import { useAuthStore } from "@/stores/auth"

// ApiError messages are Persian (translated in client.ts); anything else
// (browser/network internals) must not leak English into the toast.
function fail(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "ذخیره نشد")
}

// ── IDENTITY ─────────────────────────────────────────────────

// Shared editor state so the profile card and the account-hub dialog edit
// the same draft without duplicating mutation logic.
export function useIdentityEditor() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const client = useQueryClient()
  const [firstName, setFirstName] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: updateMe,
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: ["me"] })
      const previous = client.getQueryData(["me"])
      if (user) setUser({ ...user, ...patch })
      return { previous }
    },
    onSuccess: (saved) => {
      setUser(saved)
      client.setQueryData(["me"], saved)
      toast.success("مشخصات ذخیره شد")
    },
    onError: (error, _v, context) => {
      if (context?.previous !== undefined)
        client.setQueryData(["me"], context.previous)
      if (user) setUser(user)
      fail(error)
    },
  })

  if (!user) return null
  const first = firstName ?? user.first_name
  const last = lastName ?? user.last_name

  function onSave() {
    if (!first.trim() || !last.trim()) {
      toast.error("نام و نام خانوادگی را کامل کنید")
      return
    }
    save.mutate(
      { first_name: first.trim(), last_name: last.trim() },
      {
        onSuccess: () => {
          setFirstName(null)
          setLastName(null)
        },
      }
    )
  }

  return {
    user,
    first,
    last,
    dirty: first.trim() !== user.first_name || last.trim() !== user.last_name,
    pending: save.isPending,
    setFirst: setFirstName,
    setLast: setLastName,
    onSave,
  }
}

export function IdentityFields({
  editor,
}: {
  editor: NonNullable<ReturnType<typeof useIdentityEditor>>
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="profile-first">نام</FieldLabel>
          <Input
            id="profile-first"
            value={editor.first}
            onChange={(e) => editor.setFirst(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-last">نام خانوادگی</FieldLabel>
          <Input
            id="profile-last"
            value={editor.last}
            onChange={(e) => editor.setLast(e.target.value)}
          />
        </Field>
      </div>
      {editor.dirty && (
        <Button
          type="button"
          size="xs"
          className="mt-3"
          disabled={editor.pending}
          onClick={editor.onSave}
        >
          {editor.pending ? "…" : "ذخیره مشخصات"}
        </Button>
      )}
    </>
  )
}

export function IdentitySection() {
  const editor = useIdentityEditor()
  if (!editor) return <Skeleton className="h-32 w-full" />
  const { user } = editor

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {`${user.first_name} ${user.last_name}`.trim() || "کاربر"}
        </CardTitle>
        <CardDescription className="flex flex-col gap-1">
          <span dir="ltr" className="text-start">
            {user.phone.replace(/^(?!0)/, "0")}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <IdentityFields editor={editor} />
      </CardContent>
    </Card>
  )
}

// ── PASSWORD ─────────────────────────────────────────────────

export function PasswordFields() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [repeat, setRepeat] = useState("")

  const save = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrent("")
      setNext("")
      setRepeat("")
      toast.success("گذرواژه تغییر کرد")
    },
    onError: fail,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!current) {
      toast.error("گذرواژه فعلی را وارد کنید")
      return
    }
    if (next.length < 8) {
      toast.error("گذرواژه جدید دست‌کم ۸ نویسه باشد")
      return
    }
    if (next !== repeat) {
      toast.error("تکرار گذرواژه با گذرواژه جدید یکسان نیست")
      return
    }
    save.mutate({ current_password: current, new_password: next })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="profile-current">گذرواژه فعلی</FieldLabel>
        <Input
          id="profile-current"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="profile-new">گذرواژه جدید</FieldLabel>
          <Input
            id="profile-new"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-repeat">تکرار گذرواژه جدید</FieldLabel>
          <Input
            id="profile-repeat"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </Field>
      </div>
      <FieldDescription>گذرواژه جدید دست‌کم ۸ نویسه باشد.</FieldDescription>
      <Button
        type="submit"
        variant="outline"
        className="w-fit"
        disabled={save.isPending}
      >
        {save.isPending ? "…" : "تغییر گذرواژه"}
      </Button>
    </form>
  )
}

export function PasswordSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>تغییر گذرواژه</CardTitle>
      </CardHeader>
      <CardContent>
        <PasswordFields />
      </CardContent>
    </Card>
  )
}
