"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

import { fetchMe } from "@/features/auth/api"
import { getAccessToken } from "@/lib/api/client"
import { useAuthStore } from "@/stores/auth"

/**
 * Resolves the session on mount and keeps the auth store in sync.
 *
 * The access token lives in localStorage while the refresh token is an httpOnly
 * cookie, so on a cold start there may be no access token but a perfectly valid
 * session. A failed /users/me is therefore "anonymous", not an error to surface.
 */
export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser)
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)

  const query = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (query.isSuccess) setUser(query.data)
    // Only a hard failure with no token at all means "anonymous"; a 401 that the
    // client could still refresh is not a verdict.
    else if (query.isError && !getAccessToken()) setUser(null)
  }, [query.isSuccess, query.isError, query.data, setUser])

  return { user, status, isLoading: status === "loading" }
}
