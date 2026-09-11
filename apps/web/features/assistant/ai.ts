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
  tomorrowDate?: string
  tomorrowPlans?: string[]
  weekLines?: string[]
}): string {
  const list = (items: string[]) => (items.length ? items.join("، ") : "—")
  return [
    "تو دستیار خلاق یک معلم ایرانی هستی. فارسی جواب بده.",
    "هدف: ایده جالب و قابل اجرا در کلاس واقعی ایران، نه حرف کلی.",
    "هر درخواست ایده = ۲ تا ۳ پیشنهاد متفاوت (بازی، نمایش، مسابقه، داستان، تحرک، کار گروهی).",
    "قالب هر ایده: نام جذاب، زمان لازم، قدم‌های اجرا، وسایل لازم (کم‌هزینه).",
    "کلیشه ممنوع؛ «بحث گروهی» کافی نیست، سناریوی دقیق بده.",
    "از برنامه امروز/فردا تکراری نباش؛ به سن کلاس و درس وصل کن.",
    `کلاس‌ها: ${list(context.classes)}`,
    `درس‌ها: ${list(context.subjects)}`,
    `زنگ‌ها: ${list(context.periods)}`,
    `امروز: ${context.date}`,
    `برنامه امروز: ${context.plans?.length ? context.plans.join(" | ") : "خالی"}`,
    ...(context.tomorrowDate
      ? [
          `فردا: ${context.tomorrowDate}`,
          `برنامه فردا: ${context.tomorrowPlans?.length ? context.tomorrowPlans.join(" | ") : "خالی"}`,
        ]
      : []),
    ...(context.weekLines?.length
      ? ["برنامه دو هفته آینده:", ...context.weekLines]
      : []),
    PLAN_INSTRUCTIONS,
  ].join("\n")
}

// ── PLAN BLOCK ─────────────────────────────────────────────
// The model cannot write to the database; instead it appends ```plan JSON
// blocks when the teacher asks to save something. The chat page turns each
// block into a prefilled, editable card — one tap saves it through the
// normal API. One block = one lesson session; several blocks fill several days.

const PLAN_INSTRUCTIONS = [
  "وقتی معلم خواست چیزی در برنامه ثبت شود (یک ایده، یک روز، چند روز یا کل هفته):",
  "۱) تاریخ هر روز را از «امروز» یا فهرست «برنامه دو هفته آینده» به شمسی YYYY/MM/DD حساب کن.",
  "۲) نام کلاس/درس/زنگ را دقیقاً از فهرست‌های بالا کپی کن؛ اگر نگفت یا در فهرست نبود، رشته خالی بگذار.",
  "۳) برای هر جلسه یک بلوک ```plan جدا در انتهای پیام بگذار (چند بلوک پشت سر هم مجاز است، حداکثر ۱۰ بلوک) و چیز دیگری داخل بلوک ننویس:",
  "```plan",
  '{"date_jalali":"1404/08/19","activity":"متن فعالیت","class":"","subject":"","period":"","notes":""}',
  "```",
  "۴) روزی که در فهرست پر است را دوباره پیشنهاد نده، مگر اینکه معلم بخواهد جایگزین شود.",
].join("\n")

export type PlanDraft = {
  dateJalali: string
  activity: string
  className: string
  subjectName: string
  periodLabel: string
  notes: string
}

const str = (value: unknown) => (typeof value === "string" ? value : "")

/** Remove every ```plan block so only the human-readable text shows. */
export function stripPlanBlocks(text: string): string {
  return text.replace(/```plan[\s\S]*?```/g, "").trim()
}

export function stripPlanBlock(text: string): string {
  return stripPlanBlocks(text)
}

function parsePlanJson(raw: string): PlanDraft | null {
  try {
    const data = JSON.parse(raw.trim()) as Record<string, unknown>
    const draft: PlanDraft = {
      dateJalali: str(data.date_jalali),
      activity: str(data.activity),
      className: str(data.class),
      subjectName: str(data.subject),
      periodLabel: str(data.period),
      notes: str(data.notes),
    }
    if (!draft.dateJalali && !draft.activity) return null
    return draft
  } catch {
    return null
  }
}

export function extractPlanBlock(text: string): PlanDraft | null {
  const found = extractPlanBlocks(text)
  return found[0] ?? null
}

/** Every ```plan block in the reply, in order (max 10). */
export function extractPlanBlocks(text: string, limit = 10): PlanDraft[] {
  const out: PlanDraft[] = []
  const pattern = /```plan\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null && out.length < limit) {
    const draft = parsePlanJson(match[1] ?? "")
    if (draft) out.push(draft)
  }
  return out
}

export type ResolvedPlan = {
  isoDate: string | null
  activity: string
  classId: string
  subjectId: string
  periodId: string
  startTime: string
  endTime: string
  notes: string
}

function matchId<T extends { id: string }>(
  items: T[],
  nameOf: (item: T) => string,
  want: string
): string {
  const needle = want.trim()
  if (!needle) return ""
  const exact = items.find((item) => nameOf(item) === needle)
  if (exact) return exact.id
  return (
    items.find(
      (item) => nameOf(item).includes(needle) || needle.includes(nameOf(item))
    )?.id ?? ""
  )
}

/** Map model-supplied names onto real ids; unknown names stay empty for the teacher to pick. */
export function resolvePlanDraft(
  draft: PlanDraft,
  lookups: {
    classes: { id: string; name: string }[]
    subjects: { id: string; name: string }[]
    periods: {
      id: string
      label: string
      start_time: string
      end_time: string
    }[]
  },
  parseJalali: (value: string) => string | null
): ResolvedPlan {
  const periodId = matchId(lookups.periods, (p) => p.label, draft.periodLabel)
  const period = lookups.periods.find((p) => p.id === periodId)
  return {
    isoDate: draft.dateJalali ? parseJalali(draft.dateJalali) : null,
    activity: draft.activity,
    classId: matchId(lookups.classes, (c) => c.name, draft.className),
    subjectId: matchId(lookups.subjects, (s) => s.name, draft.subjectName),
    periodId,
    startTime: period?.start_time.slice(0, 5) ?? "",
    endTime: period?.end_time.slice(0, 5) ?? "",
    notes: draft.notes,
  }
}
