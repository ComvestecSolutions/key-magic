import type { PropsWithChildren, ReactNode } from 'react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SectionCardProps extends PropsWithChildren {
  title: string
  subtitle?: string
  eyebrow?: string
  action?: ReactNode
}

export function SectionCard({ title, subtitle, eyebrow, action, children }: SectionCardProps) {
  return (
    <Card className="glass-card flex w-full self-start gap-0 overflow-hidden border-0 bg-transparent py-0">
      {/* Gradient accent stripe */}
      <div className="section-card__accent h-[3px] w-full" />

      <CardHeader className="gap-2.5 border-b border-[var(--glass-border)] px-4 py-3.5 md:px-5 md:py-4">
        <div className="flex flex-col text-left gap-1">
          {eyebrow ? (
            <p className="ui-eyebrow">
              {eyebrow}
            </p>
          ) : null}
          <CardTitle className="ui-section-title md:text-xl">
            {title}
          </CardTitle>
          {subtitle ? (
            <CardDescription className="ui-copy max-w-3xl">
              {subtitle}
            </CardDescription>
          ) : null}
        </div>
        {action ? <CardAction className="flex items-start gap-1.5">{action}</CardAction> : null}
      </CardHeader>

      <CardContent className="p-4 ui-text-secondary md:p-5">{children}</CardContent>
    </Card>
  )
}
