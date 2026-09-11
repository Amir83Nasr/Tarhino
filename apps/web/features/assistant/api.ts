"use client"

import { apiFetch } from "@/lib/api/client"

import type { AiSettings, ChatMessage } from "@/features/assistant/ai"

// Server-held AI settings. The key is write-only: the server answers has_key
// and never returns the plaintext, so a login on any device sees the same setup.

export const getAiSettings = () => apiFetch<AiSettings>("/ai/settings")

export type AiSettingsInput = {
  base_url?: string
  model?: string
  api_key?: string
}

export function saveAiSettings(input: AiSettingsInput) {
  return apiFetch<AiSettings>("/ai/settings", { method: "PUT", body: input })
}

export function deleteAiKey() {
  return apiFetch<void>("/ai/settings/key", { method: "DELETE" })
}

export function chat(messages: ChatMessage[]) {
  return apiFetch<{ text: string }>("/ai/chat", {
    method: "POST",
    body: { messages },
  }).then((res) => res.text)
}
