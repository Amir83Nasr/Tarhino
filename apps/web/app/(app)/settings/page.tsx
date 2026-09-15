"use client"

import { FileSpreadsheet, GraduationCap } from "lucide-react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { ExcelSection } from "@/features/excel/excel-section"
import { ReportsSection } from "@/features/reports/reports-section"
import { ElementarySetupSection } from "@/features/settings/elementary-setup-section"

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-lg">تنظیمات</h1>
        <p className="text-sm text-muted-foreground">
          کلاس، زنگ‌ها و دانش‌آموزان؛ به‌علاوه ورود و خروج اکسل.
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
        </TabsList>

        <TabsContent value="base" className="grid grid-cols-1 gap-4">
          <ElementarySetupSection />
        </TabsContent>

        <TabsContent value="excel" className="grid grid-cols-1 gap-4">
          <ExcelSection />
          <ReportsSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
