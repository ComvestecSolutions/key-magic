"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

type DialogOverlayProps = React.ComponentProps<typeof DialogPrimitive.Overlay> & {
  slotName?: string
}

function DialogOverlay({ className, slotName = "dialog-overlay", ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      data-slot={slotName}
      className={cn(
        "fixed inset-0 isolate z-50 bg-[var(--scrim-overlay)] duration-150 supports-backdrop-blur-[6px] supports-backdrop-saturate-135 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// Export DialogSheetOverlay as an alias using DialogOverlay with slotName="dialog-sheet-overlay"
const DialogSheetOverlay = (props: React.ComponentProps<typeof DialogPrimitive.Overlay>) => (
  <DialogOverlay {...props} slotName="dialog-sheet-overlay" />
)

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100vh-1.5rem)] w-full max-w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-[var(--radius-xl)] border border-[var(--glass-border-strong)] bg-[rgba(15,18,27,0.8)] p-4 text-sm text-popover-foreground shadow-[0_36px_112px_-64px_rgba(0,0,0,0.9)] backdrop-blur-[22px] duration-100 outline-none sm:max-w-xl sm:p-5 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogSheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogSheetOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-sheet-content"
        className={cn(
          "fixed inset-0 z-50 grid h-[100dvh] w-screen gap-4 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,rgba(10,12,17,0.8),rgba(7,10,15,0.84))] p-4 text-sm text-popover-foreground shadow-[0_36px_110px_-68px_rgba(0,0,0,0.88)] backdrop-blur-[22px] duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-full data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-full md:inset-y-3 md:right-3 md:left-auto md:h-auto md:max-h-[calc(100vh-1.5rem)] md:w-[min(100%-1.5rem,66rem)] md:max-w-[66rem] md:rounded-[calc(var(--radius-xl)+2px)] md:border md:border-[rgba(255,255,255,0.1)] md:bg-[linear-gradient(180deg,rgba(18,22,33,0.8),rgba(12,15,23,0.74))] md:p-5 md:shadow-[0_32px_112px_-84px_rgba(0,0,0,0.92),-16px_0_60px_-50px_rgba(6,182,212,0.1)] md:backdrop-blur-[22px] md:data-open:slide-in-from-right-full md:data-closed:slide-out-to-right-full",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-[var(--radius-xl)] border-t border-[var(--glass-border)] bg-black/6 p-4 sm:-mx-5 sm:-mb-5 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a:hover]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogSheetContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogSheetOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
