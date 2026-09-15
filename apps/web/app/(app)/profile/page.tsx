"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { DialogFooter } from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { ResponsiveDialog } from "@workspace/ui/components/responsive-dialog"
import { toast } from "@workspace/ui/components/sonner"

import { logout, purgeMyData } from "@/features/auth/api"
import {
  IdentitySection,
  PasswordSection,
} from "@/features/profile/profile-sections"
import { useAuthStore } from "@/stores/auth"
import { setAccessToken } from "@/lib/api/client"

const LOGOUT_DESCRIPTION = "مطمئنید که می‌خواهید از حساب خود خارج شوید؟"
const DELETE_DESCRIPTION =
  "همه اطلاعات حساب شما (مدرسه‌ها، کلاس‌ها، دانش‌آموزان، کارنامه و طرح درس‌ها) برای همیشه حذف می‌شود، ولی حساب شما باقی می‌ماند. این کار برگشت‌پذیر نیست."

export default function ProfilePage() {
  const router = useRouter()
  const client = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  const [confirm, setConfirm] = useState<"logout" | "delete" | null>(null)
  const [deleteCheck, setDeleteCheck] = useState("")
  const [pending, setPending] = useState(false)

  function resetAfterLogout() {
    client.clear()
    setUser(null)
    setAccessToken(null)
    router.replace("/login")
  }

  function resetAfterPurge() {
    // Account stays: drop every cached row; week page refetches empty.
    client.clear()
    router.replace("/week")
  }

  async function onLogout() {
    setPending(true)
    try {
      await logout()
      // Drop the previous account's rows: the cache is per browser, not per user.
      resetAfterLogout()
    } finally {
      setPending(false)
      setConfirm(null)
    }
  }

  const destroy = useMutation({
    mutationFn: purgeMyData,
    onSuccess: () => {
      toast.success("اطلاعات حساب شما حذف شد")
      resetAfterPurge()
    },
    onError: () => toast.error("حذف اطلاعات انجام نشد"),
    onSettled: () => {
      setPending(false)
      setConfirm(null)
    },
  })

  const deleteArmed = deleteCheck.trim() === "حذف"

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="text-lg">پروفایل</h1>

      <IdentitySection />
      <PasswordSection />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          <Button
            variant="outline"
            onClick={() => setConfirm("logout")}
            disabled={pending}
          >
            خروج از حساب
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setDeleteCheck("")
              setConfirm("delete")
            }}
            disabled={pending}
          >
            حذف اطلاعات حساب
          </Button>
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={
          confirm === "delete" ? "حذف اطلاعات حساب" : "خروج از حساب کاربری"
        }
        description={
          confirm === "delete" ? DELETE_DESCRIPTION : LOGOUT_DESCRIPTION
        }
      >
        {confirm === "delete" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              برای تأیید، کلمه «حذف» را بنویسید.
            </p>
            <Input
              value={deleteCheck}
              onChange={(e) => setDeleteCheck(e.target.value)}
              placeholder="حذف"
              aria-label="تأیید حذف"
            />
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setConfirm(null)}
            disabled={pending || destroy.isPending}
          >
            انصراف
          </Button>
          {confirm === "delete" ? (
            <Button
              variant="destructive"
              disabled={pending || destroy.isPending || !deleteArmed}
              onClick={() => {
                setPending(true)
                destroy.mutate()
              }}
            >
              حذف برای همیشه
            </Button>
          ) : (
            <Button variant="destructive" onClick={onLogout} disabled={pending}>
              خروج
            </Button>
          )}
        </DialogFooter>
      </ResponsiveDialog>
    </div>
  )
}
