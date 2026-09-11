"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { ThemeProvider } from "@/components/theme-provider"

/** Registers the offline shell worker. Production only — a service worker in dev
 * serves stale chunks and makes HMR lie to you. */
function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    void navigator.serviceWorker.register("/sw.js")
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  // useState, not a module-level client: each browser session gets its own cache
  // and the server never shares one across requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Dexie is the source of truth for offline reads, so a failed request
            // should not keep retrying in the background.
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors />
          <ServiceWorker />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
