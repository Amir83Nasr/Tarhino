const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
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

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  })

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
    if (typeof data.detail === "string") return data.detail
    if (Array.isArray(data.detail)) return "اطلاعات ارسالی نامعتبر است"
  } catch {
    // fall through to the generic message
  }
  return `خطای سرور (${response.status})`
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
