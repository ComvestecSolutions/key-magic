import type { PropsWithChildren, ReactNode } from 'react'

interface SectionCardProps extends PropsWithChildren {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function SectionCard({ title, subtitle, action, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <header className="section-card__header">
        <div>
          <p className="section-card__eyebrow">Module</p>
          <h2>{title}</h2>
          {subtitle ? <p className="section-card__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="section-card__action">{action}</div> : null}
      </header>
      <div className="section-card__body">{children}</div>
    </section>
  )
}
