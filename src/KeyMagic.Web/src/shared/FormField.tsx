import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FormFieldProps extends PropsWithChildren {
  label: string
  id?: string // id to associate label with input/control
  description?: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  headerAction?: ReactNode
  className?: string
  /**
   * If you pass an id, ensure the child input/control receives the same id, or set aria-labelledby to the label id.
   */
}

export function FormField({
  label,
  id,
  description,
  hint,
  error,
  required = false,
  headerAction,
  className,
  children,
}: FormFieldProps) {
  const labelId = id ? `${id}-label` : undefined

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {id ? (
              <label id={labelId} className="ui-eyebrow" htmlFor={id}>
                {label}
              </label>
            ) : (
              <span id={labelId} className="ui-eyebrow">{label}</span>
            )}
            {required ? (
              <span className="rounded-[var(--radius-sm)] border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--amber)]">
                Required
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="ui-copy-xs">
              {description}
            </p>
          ) : null}
        </div>
        {headerAction}
      </div>

      {children}

      {error ? (
        <p className="m-0 text-xs font-medium ui-text-rose">
          {error}
        </p>
      ) : hint ? (
        <p className="ui-copy-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  )
}