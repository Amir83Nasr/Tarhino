"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { DialogFooter } from "@workspace/ui/components/dialog"
import { ResponsiveDialog } from "@workspace/ui/components/responsive-dialog"

import { logout } from "@/features/auth/api"
import { useAuthStore } from "@/stores/auth"

export default function ProfilePage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function onLogout() {
    setPending(true)
    try {
      await logout()
      setUser(null)
      router.replace("/login")
    } finally {
      setPending(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="text-lg">پروفایل</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            {user ? `${user.first_name} ${user.last_name}`.trim() : "کاربر"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground" dir="ltr">
          {user?.phone.replace(/^(?!0)/, "0")}
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        className="w-fit"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
      >
        خروج از حساب
      </Button>

      <ResponsiveDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="خروج از حساب کاربری"
        description="مطمئنید که می‌خواهید از حساب خود خارج شوید؟"
      >
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(false)}
            disabled={pending}
          >
            انصراف
          </Button>
          <Button variant="destructive" onClick={onLogout} disabled={pending}>
            خروج
          </Button>
        </DialogFooter>
      </ResponsiveDialog>
    </div>
  )
}
