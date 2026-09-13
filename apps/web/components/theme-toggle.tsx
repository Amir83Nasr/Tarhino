"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

/** CSS-only icon swap via `dark:` — no mounted state, no hydration flash. */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative max-sm:size-11"
            aria-label="تغییر تم"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          />
        }
      >
        <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </TooltipTrigger>
      <TooltipContent>تغییر تم</TooltipContent>
    </Tooltip>
  )
}
