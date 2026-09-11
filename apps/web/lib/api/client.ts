// NEXT_PUBLIC_API_URL may be the bare host (with or without trailing slash)
// on deploy platforms — normalize to ".../api/v1" so requests never land on
// //auth/... (404). Paths passed to apiFetch always start with one "/".
const API_PREFIX = "/api/v1"

const BASE_URL = (() => {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:8000${API_PREFIX}`
  ).replace(/\/+$/, "")
  return raw.endsWith(API_PREFIX) ? raw : `${raw}${API_PREFIX}`
})()

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ── ERROR TRANSLATION ──────────────────────────────────────
// Every server-facing message the UI shows must be Persian in the app font.
// The API returns English details, so translate them here, at the single choke
// point all requests go through. Unknown details fall back to a status-based
// Persian message; never surface raw English text to the user.

const DETAIL_TRANSLATIONS: Record<string, string> = {
  "Not authenticated": "نشست شما پایان یافته است، دوباره وارد شوید",
  "Invalid phone or password": "شماره موبایل یا گذرواژه نادرست است",
  "Phone number already registered": "این شماره قبلاً ثبت شده است",
  "Missing refresh token": "نشست شما پایان یافته است، دوباره وارد شوید",
  "Invalid refresh token": "نشست شما پایان یافته است، دوباره وارد شوید",
  "Refresh token no longer valid": "نشست شما پایان یافته است، دوباره وارد شوید",
  "Not found": "مورد موردنظر پیدا نشد",
  "ID already in use": "این شناسه قبلاً استفاده شده است",
}

const FIELD_TRANSLATIONS: Record<string, string> = {
  phone: "شماره موبایل",
  password: "گذرواژه",
  first_name: "نام",
  last_name: "نام خانوادگی",
  class_id: "کلاس",
  subject_id: "درس",
  period_id: "زنگ",
  activity: "فعالیت",
  date: "تاریخ",
  name: "نام",
  label: "نام زنگ",
  grade: "پایه",
  start_time: "ساعت شروع",
  end_time: "ساعت پایان",
  color: "رنگ",
  notes: "یادداشت",
  status: "وضعیت",
  order_index: "ترتیب",
}

const VALIDATION_MSG_TRANSLATIONS: Record<string, (f: string) => string> = {
  "Field required": (f) => `فیلد «${f}» الزامی است`,
  "Invalid Iranian mobile number": () =>
    "شماره موبایل معتبر نیست؛ نمونه: ۰۹۱۲۳۴۵۶۷۸۹",
}

function translateDetail(status: number, detail: string): string {
  const exact = DETAIL_TRANSLATIONS[detail]
  if (exact) return exact
  // "Unknown period_id" style from the teaching router.
  const unknown = detail.match(/^Unknown (\w+)$/)
  const field = unknown?.[1]
  if (field) return `«${FIELD_TRANSLATIONS[field] ?? field}» معتبر نیست`
  return fallbackForStatus(status)
}

function translateValidation(detail: unknown[]): string {
  for (const item of detail) {
    const entry = item as { loc?: unknown[]; msg?: string }
    if (!entry || typeof entry.msg !== "string") continue
    const fieldKey = Array.isArray(entry.loc)
      ? String(entry.loc[entry.loc.length - 1] ?? "")
      : ""
    const field = FIELD_TRANSLATIONS[fieldKey] ?? fieldKey
    // Pydantic prefixes custom validator messages with "Value error, ".
    const msg = entry.msg.replace(/^Value error,\s*/, "")
    const translate = VALIDATION_MSG_TRANSLATIONS[msg]
    if (translate) return translate(field)
    if (field) return `«${field}» نامعتبر است`
  }
  return "اطلاعات ارسالی نامعتبر است"
}

function fallbackForStatus(status: number): string {
  if (status === 401 || status === 403)
    return "نشست شما پایان یافته است، دوباره وارد شوید"
  if (status === 404) return "مورد موردنظر پیدا نشد"
  if (status === 409) return "این اطلاعات با تغییرات دیگران در تضاد است"
  if (status === 429) return "تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید"
  if (status >= 500) return "خطایی از سمت سرور رخ داد؛ لطفاً بعداً تلاش کنید"
  return "درخواست ناموفق بود"
}

// ── TOKEN STORAGE ──────────────────────────────────────────
// ponytail: access token in localStorage. The refresh token is an httpOnly cookie
// the browser sends automatically, so JS never holds a long-lived credential.
// Move to a BFF route or service worker if XSS token theft becomes the threat.

const ACCESS_TOKEN_KEY = "tarhino.access_token"

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return
  if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
  else window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

// ── REQUEST ────────────────────────────────────────────────

type RequestOptions = {
  method?: string
  body?: unknown
  /** Set false for auth endpoints, which must not attempt a refresh. */
  retryOnUnauthorized?: boolean
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, retryOnUnauthorized = true } = options

  const headers = new Headers()
  if (body !== undefined) headers.set("Content-Type", "application/json")
  const token = getAccessToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    // fetch rejects with "Failed to fetch" on network failure (offline, wrong
    // API URL, CORS refusal). Show a Persian message instead of the raw error.
    if (error instanceof TypeError) {
      throw new ApiError(
        0,
        "ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید"
      )
    }
    throw error
  }

  // One silent refresh attempt, then give up.
  if (response.status === 401 && retryOnUnauthorized) {
    if (await refreshAccessToken()) {
      return apiFetch<T>(path, { ...options, retryOnUnauthorized: false })
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response))
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown }
    if (typeof data.detail === "string")
      return translateDetail(response.status, data.detail)
    if (Array.isArray(data.detail)) return translateValidation(data.detail)
  } catch {
    // fall through to the generic message
  }
  return fallbackForStatus(response.status)
}

let refreshInFlight: Promise<boolean> | null = null

/** Coalesces concurrent 401s into a single refresh call. */
export function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      if (!response.ok) {
        setAccessToken(null)
        return false
      }
      const data = (await response.json()) as { access_token: string }
      setAccessToken(data.access_token)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}
