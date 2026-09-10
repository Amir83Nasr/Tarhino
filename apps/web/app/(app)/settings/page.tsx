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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Separator } from "@workspace/ui/components/separator"

import { logout } from "@/features/auth/api"
import { ExcelSection } from "@/features/excel/excel-section"
import { ConflictsSection } from "@/features/settings/conflicts-section"
import {
  ClassesSection,
  PeriodsSection,
  SubjectsSection,
} from "@/features/settings/settings-sections"
import { useAuthStore } from "@/stores/auth"

export default function SettingsPage() {
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
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="font-heading text-lg">تنظیمات</h1>

      <ConflictsSection />
      <ClassesSection />
      <SubjectsSection />
      <PeriodsSection />
      <ExcelSection />

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>
            {user ? `${user.first_name} ${user.last_name}`.trim() : "کاربر"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground" dir="ltr">
          {user?.phone}
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
      >
        خروج از حساب
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>خروج از حساب کاربری</DialogTitle>
            <DialogDescription>
              مطمئنید که می‌خواهید از حساب خود خارج شوید؟
            </DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
