"use client"

import { FileSpreadsheet, GraduationCap, Sparkles } from "lucide-react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { AiSettingsSection } from "@/features/assistant/assistant-settings"
import { ExcelSection } from "@/features/excel/excel-section"
import {
  ClassesSection,
  PeriodsSection,
  SubjectsSection,
} from "@/features/settings/settings-sections"

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-lg">تنظیمات</h1>
        <p className="text-sm text-muted-foreground">
          اطلاعات پایه، ورود و خروج اکسل، و اتصال هوش مصنوعی.
        </p>
      </div>

      <Tabs defaultValue="base">
        <TabsList className="w-full group-data-horizontal/tabs:h-10">
          <TabsTrigger value="base" className="gap-1.5">
            <GraduationCap />
            پایه
          </TabsTrigger>
          <TabsTrigger value="excel" className="gap-1.5">
            <FileSpreadsheet />
            اکسل
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Sparkles />
            هوش مصنوعی
          </TabsTrigger>
        </TabsList>

        <TabsContent value="base" className="grid grid-cols-1 gap-4">
          <ClassesSection />
          <SubjectsSection />
          <PeriodsSection />
        </TabsContent>

        <TabsContent value="excel" className="grid grid-cols-1 gap-4">
          <ExcelSection />
        </TabsContent>

        <TabsContent value="ai" className="grid grid-cols-1 gap-4">
          <AiSettingsSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
