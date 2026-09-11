"use client"

import { AiSettingsSection } from "@/features/assistant/assistant-settings"
import { ExcelSection } from "@/features/excel/excel-section"
import {
  ClassesSection,
  PeriodsSection,
  SubjectsSection,
} from "@/features/settings/settings-sections"

export default function SettingsPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
      <h1 className="text-lg lg:col-span-full">تنظیمات</h1>

      <ClassesSection />
      <SubjectsSection />
      <PeriodsSection />
      <ExcelSection />
      <AiSettingsSection />
    </div>
  )
}
