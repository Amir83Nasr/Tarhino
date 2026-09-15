import type { Metadata } from "next"

import { AppShell } from "@/components/app-shell"

// Panel needs login: keep it out of the search index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
