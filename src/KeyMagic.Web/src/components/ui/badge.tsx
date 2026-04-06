import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[var(--radius-sm)] border border-transparent px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.14)] text-[var(--amber)] [a]:hover:bg-[rgba(245,158,11,0.2)]",
        success:
          "border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.12)] text-[var(--emerald)] [a]:hover:bg-[rgba(16,185,129,0.18)]",
        warning:
          "border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.1)] text-[var(--amber)] [a]:hover:bg-[rgba(245,158,11,0.16)]",
        // 'info' and 'secondary' were nearly identical; use only 'info' for cyan styling.
        info:
          "border-[rgba(6,182,212,0.18)] bg-[rgba(6,182,212,0.1)] text-[var(--cyan)] [a]:hover:bg-[rgba(6,182,212,0.16)]",
        destructive:
          "border-[rgba(244,63,94,0.2)] bg-[rgba(244,63,94,0.12)] text-[var(--rose)] focus-visible:ring-destructive/20 [a]:hover:bg-[rgba(244,63,94,0.2)]",
        secondary:
          "border-[rgba(255,255,255,0.08)] bg-white/[0.08] text-[var(--text)] [a]:hover:bg-white/[0.12]",
        outline:
          "border-[var(--glass-border-strong)] bg-white/[0.04] text-[var(--text-secondary)] [a]:hover:bg-white/[0.08] [a]:hover:text-[var(--text)]",
        ghost:
          "text-[var(--text-tertiary)] hover:bg-white/[0.06] hover:text-[var(--text-secondary)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
