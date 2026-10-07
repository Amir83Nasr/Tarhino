"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  KeyRound,
  LogOut,
  MessageSquareHeart,
  Phone,
  Settings,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { DialogFooter } from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { ResponsiveDialog } from "@workspace/ui/components/responsive-dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { logout, purgeMyData } from "@/features/auth/api"
import { ReportsCenter } from "@/features/reports/reports-center"
import {
  IdentityFields,
  PasswordFields,
  useIdentityEditor,
} from "@/features/profile/profile-sections"
import { setAccessToken } from "@/lib/api/client"
import { formatNumericDate, fromISODate } from "@/lib/date/jalali"
import { useAuthStore } from "@/stores/auth"

// ── ACCOUNT HUB ─────────────────────────────────────────────────
// Narrow column: identity card, account/security rows, support row,
// danger zone last. Edit/password forms live in dialogs.

const LOGOUT_DESCRIPTION = "مطمئنید که می‌خواهید از حساب خود خارج شوید؟"
const DELETE_DESCRIPTION =
  "همه اطلاعات حساب شما (مدرسه‌ها، کلاس‌ها، دانش‌آموزان، کارنامه و طرح درس‌ها) برای همیشه حذف می‌شود، ولی حساب شما باقی می‌ماند. این کار برگشت‌پذیر نیست."

type Row = {
  href?: string
  label: string
  hint?: string
  icon: LucideIcon
  tone?: "default" | "danger"
  action?: () => void
}

function HubRow({ row }: { row: Row }) {
  const Icon = row.icon
  const inner = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          row.tone === "danger"
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/8 text-primary group-hover:bg-primary/12"
        )}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-right text-[15px]",
            row.tone === "danger" ? "text-destructive" : undefined
          )}
        >
          {row.label}
        </span>
        {row.hint && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {row.hint}
          </span>
        )}
      </span>
      <ChevronLeft className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:-translate-x-0.5 group-hover:text-muted-foreground" />
    </>
  )
  const cls =
    "group flex min-h-[48px] w-full items-center gap-3 rounded-xl px-2 text-sm transition-colors hover:bg-muted/70 active:bg-muted/90"
  if (row.href) {
    return (
      <Link href={row.href} className={cls}>
        {inner}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={row.action}
      className={cn(cls, "cursor-pointer")}
    >
      {inner}
    </button>
  )
}

function HubGroup({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-0.5 p-2">
        {rows.map((row) => (
          <HubRow key={row.label} row={row} />
        ))}
      </div>
    </section>
  )
}

export function AccountHub() {
  const router = useRouter()
  const client = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)
  const setUser = useAuthStore((s) => s.setUser)
  const editor = useIdentityEditor()

  const [dialog, setDialog] = useState<"identity" | "password" | null>(null)
  const [confirm, setConfirm] = useState<"logout" | "delete" | null>(null)
  const [deleteCheck, setDeleteCheck] = useState("")
  const [pending, setPending] = useState(false)

  function resetAfterLogout() {
    client.clear()
    setUser(null)
    setAccessToken(null)
    router.replace("/login")
  }

  async function onLogout() {
    setPending(true)
    try {
      await logout()
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
      client.clear()
      router.replace("/week")
    },
    onError: () => toast.error("حذف اطلاعات انجام نشد"),
    onSettled: () => {
      setPending(false)
      setConfirm(null)
    },
  })

  const deleteArmed = deleteCheck.trim() === "حذف"
  const joined = user
    ? formatNumericDate(fromISODate(user.created_at.slice(0, 10)))
    : null

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      {/* Identity card */}
      <div className="rounded-2xl border bg-card p-3">
        {status !== "authenticated" || !user ? (
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/12 text-base font-bold text-primary">
              {(user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "") ||
                "ک"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">
                {`${user.first_name} ${user.last_name}`.trim() || "کاربر"}
              </p>
              <p
                dir="ltr"
                className="mt-1 text-right text-sm text-muted-foreground"
              >
                {user.phone.replace(/^(?!0)/, "0")}
              </p>
              {joined && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  عضو از {joined}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setDialog("identity")}
            >
              ویرایش
            </Button>
          </div>
        )}
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-3">
        <ReportsCenter />
        <HubGroup
          title="حساب و امنیت"
          rows={[
            {
              label: "تغییر گذرواژه",
              hint: "دست‌کم ۸ نویسه",
              icon: KeyRound,
              action: () => setDialog("password"),
            },
            {
              href: "/settings",
              label: "کلاس من",
              hint: "مدرسه، زنگ‌ها و دانش‌آموزان",
              icon: Settings,
            },
          ]}
        />
        <HubGroup
          title="کمک و بازخورد"
          rows={[
            { href: "/assistant", label: "دستیار طرحینو", icon: Sparkles },
            {
              href: "/feedback",
              label: "انتقادها و پیشنهادها",
              icon: MessageSquareHeart,
            },
            {
              href: "tel:+989306853363",
              label: "تماس با پشتیبانی",
              hint: "۰۹۳۰۶۸۵۳۳۶۳",
              icon: Phone,
            },
          ]}
        />

        {/* Danger zone */}
        <section className="overflow-hidden rounded-2xl border border-destructive/20 bg-card">
          <p className="px-4 pt-3 pb-1 text-xs font-bold text-destructive/70">
            خروج و حذف
          </p>
          <div className="flex flex-col gap-0.5 p-2">
            <HubRow
              row={{
                label: "خروج از حساب",
                icon: LogOut,
                tone: "danger",
                action: () => setConfirm("logout"),
              }}
            />
            <HubRow
              row={{
                label: "حذف اطلاعات حساب",
                hint: "مدرسه‌ها، کلاس‌ها و کارنامه‌ها",
                icon: Trash2,
                tone: "danger",
                action: () => {
                  setDeleteCheck("")
                  setConfirm("delete")
                },
              }}
            />
          </div>
        </section>
      </div>

      {/* Edit / password dialogs */}
      <ResponsiveDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title={dialog === "password" ? "تغییر گذرواژه" : "ویرایش نام"}
      >
        {dialog === "password" ? (
          <PasswordFields />
        ) : editor ? (
          <IdentityFields editor={editor} />
        ) : (
          <Skeleton className="h-20 w-full" />
        )}
      </ResponsiveDialog>

      {/* Logout / delete confirms */}
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
