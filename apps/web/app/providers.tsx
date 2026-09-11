"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  // useState, not a module-level client: each browser session gets its own cache
  // and the server never shares one across requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Fresh a minute; no refetch on tab focus — the list must not
            // blink every time the teacher switches back to the tab.
            // Lookups override this with their own 10-min cache (hooks.ts).
            staleTime: 60_000,
            refetchOnWindowFocus: false,
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
          <Toaster position="top-left" richColors />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
