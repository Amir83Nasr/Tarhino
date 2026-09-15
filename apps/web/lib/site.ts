// ── SITE ────────────────────────────────────────────────────
// Single source of truth for public SEO URLs. Override with
// NEXT_PUBLIC_SITE_URL when the custom domain goes live.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tarhino.vercel.app"
).replace(/\/$/, "")

export const SITE_NAME = "طرحینو"

export const SITE_DESCRIPTION =
  "طرحینو؛ طرح درس هفتگی، کارنامه و دستیار معلم در یک‌جا. بدون نصب، روی گوشی و دسکتاپ."
