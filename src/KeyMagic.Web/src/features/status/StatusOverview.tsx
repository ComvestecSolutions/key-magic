import type { StatusSnapshot, StatusStats } from '../../app/types'
import { SectionCard } from '../../shared/SectionCard'

interface StatusOverviewProps {
  status: StatusSnapshot
  stats: StatusStats
  busy: boolean
  onToggleGlobal: () => void
  onRefresh: () => void
}

export function StatusOverview({ status, stats, busy, onToggleGlobal, onRefresh }: StatusOverviewProps) {
  const statCards = [
    { label: 'Blocking rules', value: status.totalRules, tone: 'neutral' },
    { label: 'Active rules', value: status.activeRules, tone: 'accent' },
    { label: 'Blocked events', value: stats.blockedCount, tone: 'danger' },
    { label: 'Pass-through events', value: stats.passedCount, tone: 'success' },
  ]

  return (
    <SectionCard
      title="Control Center"
      subtitle="Real-time keyboard enforcement, automation, and observability from one local dashboard."
      action={
        <div className="inline-actions">
          <button type="button" className="ghost-button" onClick={onRefresh} disabled={busy}>
            Refresh
          </button>
          <button type="button" className="primary-button" onClick={onToggleGlobal} disabled={busy}>
            {status.globalEnabled ? 'Pause blocking' : 'Resume blocking'}
          </button>
        </div>
      }
    >
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Runtime state</p>
          <h1>Key Magic</h1>
          <p className="hero-copy">
            {status.globalEnabled ? 'Protection is live.' : 'Protection is paused.'} Web dashboard on port {status.webDashboardPort}. Hook {status.hookActive ? 'connected' : 'inactive'}.
          </p>
        </div>
        <div className={`status-pill ${status.globalEnabled ? 'status-pill--live' : 'status-pill--paused'}`}>
          {status.globalEnabled ? 'Live control' : 'Paused'}
        </div>
      </div>

      <div className="metric-grid">
        {statCards.map((card) => (
          <article key={card.label} className={`metric-card metric-card--${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="two-column-grid">
        <div>
          <h3>Most blocked shortcuts</h3>
          <ul className="rank-list">
            {stats.topBlocked.length === 0 ? <li>No blocked shortcuts yet.</li> : null}
            {stats.topBlocked.map((entry) => (
              <li key={entry.shortcut}>
                <span>{entry.shortcut}</span>
                <strong>{entry.count}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Process pressure</h3>
          <ul className="rank-list">
            {stats.topProcesses.length === 0 ? <li>No process activity yet.</li> : null}
            {stats.topProcesses.map((entry) => (
              <li key={entry.process}>
                <span>{entry.process}</span>
                <strong>{entry.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionCard>
  )
}
