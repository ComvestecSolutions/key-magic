import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentPropsWithoutRef<"textarea">>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--glass-border-strong)] bg-[rgba(8,11,18,0.62)] px-3 py-2.5 text-sm leading-5 text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] supports-[backdrop-filter]:backdrop-blur-[10px] outline-none transition-[background-color,border-color,box-shadow] placeholder:text-[var(--text-tertiary)] focus-visible:border-ring focus-visible:bg-[rgba(10,13,20,0.84)] focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[rgba(8,11,18,0.42)] disabled:opacity-50 aria-invalid:border-destructive aria-invalid:bg-[rgba(32,10,16,0.66)] aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  )
})

export { Textarea }