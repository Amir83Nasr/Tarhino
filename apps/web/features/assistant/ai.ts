// Assistant prompts and defaults. Settings live on the teacher's account
// (GET/PUT /ai/settings); the API key never touches this client beyond the
// settings form that submits it.

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type AiSettings = {
  base_url: string | null
  model: string | null
  has_key: boolean
}

export const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
export const DEFAULT_MODEL = "liquid/lfm-2.5-2.6b:free"

// ── PROMPTS ────────────────────────────────────────────────

export function systemPrompt(context: {
  classes: string[]
  subjects: string[]
  periods: string[]
  date: string
  plans?: string[]
}): string {
  const list = (items: string[]) => (items.length ? items.join("، ") : "—")
  return [
    "تو دستیار یک معلم ایرانی هستی. فارسی و کوتاه جواب بده.",
    `کلاس‌ها: ${list(context.classes)}`,
    `درس‌ها: ${list(context.subjects)}`,
    `زنگ‌ها: ${list(context.periods)}`,
    `امروز: ${context.date}`,
    `برنامه امروز: ${context.plans?.length ? context.plans.join(" | ") : "خالی"}`,
  ].join("\n")
}
