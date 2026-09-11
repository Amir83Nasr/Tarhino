"use client"

import { useEffect, useState } from "react"

/** Browser connectivity. Not a guarantee the API is reachable, just a cheap hint. */
export function useOnline(): boolean {
  // Seeded optimistically: the server has no connectivity to report, and a
  // hydration mismatch here would rebuild the tree on every cold load.
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)

    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  return online
}
