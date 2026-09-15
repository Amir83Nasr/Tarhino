import { apiFetch, setAccessToken } from "@/lib/api/client"
import type { GradingMode, TokenResponse, User } from "@/lib/api/types"

export async function login(
  phone: string,
  password: string
): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: { phone, password },
    retryOnUnauthorized: false,
  })
  setAccessToken(data.access_token)
  return data
}

export async function register(input: {
  phone: string
  first_name: string
  last_name: string
  password: string
}): Promise<User> {
  return apiFetch<User>("/auth/register", {
    method: "POST",
    body: input,
    retryOnUnauthorized: false,
  })
}

export async function checkPhone(phone: string): Promise<boolean> {
  const data = await apiFetch<{ exists: boolean }>("/auth/check-phone", {
    method: "POST",
    body: { phone },
    retryOnUnauthorized: false,
  })
  return data.exists
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>("/auth/logout", {
      method: "POST",
      retryOnUnauthorized: false,
    })
  } finally {
    // Clear locally even if the server call fails: the user asked to log out.
    setAccessToken(null)
  }
}

export function fetchMe(): Promise<User> {
  // Default retry: on a cold start there is no access token but the refresh
  // cookie may still be valid, and this call is what restores the session.
  return apiFetch<User>("/users/me")
}

export function updateMe(patch: {
  first_name?: string
  last_name?: string
}): Promise<User> {
  return apiFetch<User>("/users/me", { method: "PATCH", body: patch })
}

export function changePassword(input: {
  current_password: string
  new_password: string
}): Promise<void> {
  return apiFetch<void>("/users/me/password", { method: "POST", body: input })
}

export function purgeMyData(): Promise<void> {
  return apiFetch<void>("/users/me/data", { method: "DELETE" })
}

// ── GRADING MODE (whole-teacher numeric vs descriptive) ──────
// One key for all subjects together. The server re-describes old grades
// under each subject's scale on switch and returns how many it converted.

export function setGradingMode(mode: GradingMode): Promise<{
  user: User
  converted: number
}> {
  return apiFetch<{ user: User; converted: number }>("/users/me/grading-mode", {
    method: "POST",
    body: { grading_mode: mode },
  })
}
