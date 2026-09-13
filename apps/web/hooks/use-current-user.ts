"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

import { fetchMe } from "@/features/auth/api"
import { ApiError, getAccessToken } from "@/lib/api/client"
import { useAuthStore } from "@/stores/auth"

/**
 * Resolves the session on mount and keeps the auth store in sync.
 *
 * No access token means anonymous without any network call: probing /users/me
 * (plus the automatic refresh retry) would only produce 401 noise for visitors
 * who never signed in. A failed probe is "anonymous", not an error to surface —
 * except a network failure (status 0), which leaves the status alone so an
 * offline user is not bounced to /login.
 */
export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser)
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)

  // Read per render so a login/logout flips the query on the next render.
  const hasToken = getAccessToken() !== null

  const query = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!hasToken) {
      setUser(null)
      return
    }
    if (query.isSuccess) setUser(query.data)
    else if (
      query.isError &&
      (!(query.error instanceof ApiError) || query.error.status !== 0)
    )
      setUser(null)
  }, [
    hasToken,
    query.isSuccess,
    query.isError,
    query.data,
    query.error,
    setUser,
  ])

  return { user, status, isLoading: status === "loading" }
}
