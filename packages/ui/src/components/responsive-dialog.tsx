"use client"

import * as React from "react"

import { useIsMobile } from "@workspace/ui/hooks/use-is-mobile"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

// Dialog on desktop, bottom drawer on mobile. Children render as-is in both,
// so forms keep their own footer inside `children`.
function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      {/* Mobile: no auto-focus, so the virtual keyboard stays hidden until
          the user taps an input. Desktop Dialog keeps the default. */}
      <DrawerContent initialFocus={false}>
        <DrawerHeader className="text-start">
          <DrawerTitle>{title}</DrawerTitle>
          {description && (
            <DrawerDescription className="text-start">
              {description}
            </DrawerDescription>
          )}
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export { ResponsiveDialog }
