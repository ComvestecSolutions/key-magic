import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border outline-none transition-all after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[20px] data-[size=default]:w-[36px] data-[size=sm]:h-[18px] data-[size=sm]:w-[30px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[state=checked]:border-[rgba(245,158,11,0.38)] data-[state=checked]:bg-[linear-gradient(180deg,rgba(245,158,11,1),rgba(217,119,6,0.96))] data-[state=unchecked]:border-[rgba(255,255,255,0.22)] data-[state=unchecked]:bg-[rgba(255,255,255,0.12)] data-[state=unchecked]:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-[rgba(7,10,15,0.98)] ring-0 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] transition-transform duration-200 group-data-[size=default]/switch:size-[16px] group-data-[size=sm]/switch:size-[14px] group-data-[size=default]/switch:data-[state=checked]:translate-x-[16px] group-data-[size=sm]/switch:data-[state=checked]:translate-x-[12px] group-data-[size=default]/switch:data-[state=unchecked]:translate-x-[1px] group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-[1px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
