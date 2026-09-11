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

import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "@/features/assistant/ai"
import {
  deleteAiKey,
  getAiSettings,
  saveAiSettings,
} from "@/features/assistant/api"

export function AiSettingsSection() {
  const client = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: getAiSettings,
  })

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
      await saveAiSettings({
        base_url: urlValue.trim(),
        model: modelValue.trim(),
        api_key: key.trim() || undefined,
      })
      setKey("")
      await client.invalidateQueries({ queryKey: ["ai-settings"] })
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
      await deleteAiKey()
      await client.invalidateQueries({ queryKey: ["ai-settings"] })
      toast.success("کلید حذف شد")
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
            ? "کلید ذخیره شده و در همه دستگاه‌های شما فعال است."
            : "کلید API را وارد کنید تا چت و ساخت طرح درس فعال شود."}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-key">کلید API</Label>
          <Input
            id="ai-key"
            type="password"
            dir="ltr"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={settings?.has_key ? "•••• ذخیره شده" : "sk-or-v1-…"}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-url">آدرس سرویس</Label>
            <Input
              id="ai-url"
              dir="ltr"
              value={urlValue}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-model">مدل</Label>
            <Input
              id="ai-model"
              dir="ltr"
              value={modelValue}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          کلید روی حساب شما رمزنگاری‌شده ذخیره می‌شود و در هر دستگاهی با همان
          حساب در دسترس است.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={save}
            disabled={saving}
          >
            ذخیره
          </Button>
          {settings?.has_key && (
            <Button
              type="button"
              variant="ghost"
              onClick={removeKey}
              disabled={saving}
            >
              حذف کلید
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
