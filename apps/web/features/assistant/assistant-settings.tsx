"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { toast } from "@workspace/ui/components/sonner"

import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  type AiSettings,
} from "@/features/assistant/ai"
import {
  deleteAiKey,
  getAiSettings,
  saveAiSettings,
} from "@/features/assistant/api"

// Same "ai-settings" key as the assistant page: one fetch serves both,
// and tab-hopping renders from cache. Save/delete set the row directly,
// so no refetch on either path.
export function useAiSettings() {
  return useQuery({
    queryKey: ["ai-settings"],
    queryFn: getAiSettings,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  }).data
}

export function AiSettingsSection() {
  const client = useQueryClient()
  const settings = useAiSettings()

  // null = untouched, fall back to the server value; no sync effect needed.
  const [url, setUrl] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [key, setKey] = useState("")
  const [saving, setSaving] = useState(false)

  const urlValue = url ?? settings?.base_url ?? DEFAULT_BASE_URL
  const modelValue = model ?? settings?.model ?? DEFAULT_MODEL

  async function save() {
    setSaving(true)
    try {
      // Only touched fields go out: untouched URL/model keep following the
      // server default, and an emptied field clears the personal override.
      const result = await saveAiSettings({
        ...(url !== null ? { base_url: url.trim() } : {}),
        ...(model !== null ? { model: model.trim() } : {}),
        ...(key.trim() ? { api_key: key.trim() } : {}),
      })
      setKey("")
      setUrl(null)
      setModel(null)
      // Server returns the saved row: swap it in, no GET after write.
      client.setQueryData(["ai-settings"], result.settings)
      toast.success("تنظیمات ذخیره شد")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "انجام نشد")
    } finally {
      setSaving(false)
    }
  }

  async function removeKey() {
    setSaving(true)
    try {
      // Server drops the personal key and returns the effective row:
      // shared default when one is configured, otherwise unconfigured.
      const next = await deleteAiKey()
      client.setQueryData<AiSettings>(["ai-settings"], next)
      toast.success(next.has_key ? "به تنظیم پیش‌فرض برگشت" : "کلید حذف شد")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "انجام نشد")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>هوش مصنوعی</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {settings?.has_key
            ? settings?.is_default
              ? "با تنظیم پیش‌فرض سرور فعال است؛ برای حساب خودتان کلید جدا وارد کنید."
              : "کلید شخصی شما ذخیره شده و در همه دستگاه‌ها فعال است."
            : "کلید API را وارد کنید تا چت و ساخت طرح درس فعال شود."}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-key">
            کلید API شخصی
            {settings?.is_default && (
              <span className="text-muted-foreground"> (اختیاری)</span>
            )}
          </Label>
          <Input
            id="ai-key"
            type="password"
            dir="ltr"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={
              settings?.has_key && !settings?.is_default
                ? "•••• ذخیره شده"
                : "خالی = استفاده از پیش‌فرض سرور"
            }
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-url">
              آدرس سرویس
              {url === null && (
                <span className="text-muted-foreground"> (پیش‌فرض سرور)</span>
              )}
            </Label>
            <Input
              id="ai-url"
              dir="ltr"
              value={urlValue}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-model">
              مدل
              {model === null && (
                <span className="text-muted-foreground"> (پیش‌فرض سرور)</span>
              )}
            </Label>
            <Input
              id="ai-model"
              dir="ltr"
              value={modelValue}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
            />
          </div>
        </div>
        {settings?.is_default ? (
          <p className="text-xs text-muted-foreground">
            با پیش‌فرض سرور کار می‌کند. آدرس یا مدل را خالی ذخیره کنید تا به
            پیش‌فرض برگردد.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            کلید روی حساب شما رمزنگاری‌شده ذخیره می‌شود و در هر دستگاهی با همان
            حساب در دسترس است.
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={save}
            disabled={saving}
          >
            ذخیره
          </Button>
          {settings?.has_key && !settings?.is_default && (
            <Button
              type="button"
              variant="ghost"
              onClick={removeKey}
              disabled={saving}
            >
              حذف کلید شخصی
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
