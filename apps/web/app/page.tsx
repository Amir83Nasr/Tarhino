"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useCurrentUser } from "@/hooks/use-current-user"

// ── ROOT ────────────────────────────────────────────────────────
// No landing page: an existing session goes straight to the panel,
// everything else to /login (which lands on /week once signed in).
export default function Page() {
  const { status } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return
    router.replace(status === "authenticated" ? "/week" : "/login")
  }, [status, router])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Image
        src="/icons/square.svg"
        alt="طرحینو"
        width={64}
        height={64}
        className="animate-pulse"
        priority
      />
    </div>
  )
}
