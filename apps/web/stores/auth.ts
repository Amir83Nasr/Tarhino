import { create } from "zustand"

import type { User } from "@/lib/api/types"

type AuthState = {
  user: User | null
  /** "loading" until the initial /users/me probe settles. */
  status: "loading" | "authenticated" | "anonymous"
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  setUser: (user) =>
    set({
      user,
      status: user ? "authenticated" : "anonymous",
    }),
}))
