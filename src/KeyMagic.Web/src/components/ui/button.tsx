import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-clip-padding text-[0.82rem] font-semibold whitespace-nowrap transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_14px_28px_-18px_rgba(245,158,11,0.8)] hover:brightness-105 [a]:hover:brightness-105",
        success:
          "border-[rgba(16,185,129,0.22)] bg-[rgba(16,185,129,0.12)] text-[var(--emerald)] shadow-[0_14px_28px_-22px_rgba(16,185,129,0.7)] hover:border-[rgba(16,185,129,0.34)] hover:bg-[rgba(16,185,129,0.2)]",
        warning:
          "border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.12)] text-[var(--amber)] shadow-[0_14px_28px_-22px_rgba(245,158,11,0.68)] hover:border-[rgba(245,158,11,0.36)] hover:bg-[rgba(245,158,11,0.2)]",
        info:
          "border-[rgba(6,182,212,0.22)] bg-[rgba(6,182,212,0.12)] text-[var(--cyan)] shadow-[0_14px_28px_-22px_rgba(6,182,212,0.66)] hover:border-[rgba(6,182,212,0.34)] hover:bg-[rgba(6,182,212,0.2)]",
        outline:
          "border-[var(--glass-border-strong)] bg-white/[0.04] text-[var(--text)] backdrop-blur-[var(--glass-blur-soft)] hover:bg-white/[0.08] hover:border-white/[0.18] aria-expanded:bg-white/[0.08] aria-expanded:text-[var(--text)]",
        secondary:
          "border-[var(--glass-border)] bg-[var(--surface-raised)] text-[var(--text)] hover:border-white/[0.16] hover:bg-white/[0.06] aria-expanded:bg-white/[0.08] aria-expanded:text-[var(--text)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text)] aria-expanded:bg-white/[0.06] aria-expanded:text-[var(--text)]",
        destructive:
          "border-[rgba(244,63,94,0.22)] bg-[rgba(244,63,94,0.12)] text-[var(--rose)] hover:border-[rgba(244,63,94,0.35)] hover:bg-[rgba(244,63,94,0.2)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-[var(--radius-sm)] px-2.5 text-[0.74rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[var(--radius-md)] px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4 text-sm has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        icon: "size-9",
        "icon-xs":
          "size-7 rounded-[var(--radius-sm)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[var(--radius-md)]",
        "icon-lg": "size-10 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
