import * as React from "react"
import * as Checkbox from "@radix-ui/react-checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function CheckboxField({
  className,
  ...props
}: React.ComponentProps<typeof Checkbox.Root>) {
  return (
    <Checkbox.Root
      data-slot="checkbox"
      className={cn(
        "peer size-[18px] shrink-0 rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.04)] text-[var(--primary-foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-all supports-[backdrop-filter]:backdrop-blur-[8px] hover:border-[rgba(255,255,255,0.3)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:shadow-[0_10px_24px_-16px_rgba(245,158,11,0.85)] data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    >
      <Checkbox.Indicator
        data-slot="checkbox-indicator"
        className="group flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]:hidden" />
        <MinusIcon className="size-3.5 hidden group-data-[state=indeterminate]:block" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}

export { CheckboxField as Checkbox }