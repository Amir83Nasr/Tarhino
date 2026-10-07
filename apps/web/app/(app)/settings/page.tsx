"use client"

import { ElementarySetupSection } from "@/features/settings/elementary-setup-section"

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-lg">کلاس من</h1>
      <ElementarySetupSection />
    </div>
  )
}
