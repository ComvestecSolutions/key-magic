import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Keyboard, RefreshCw, ScrollText, Shield } from 'lucide-react'
import type { StatusSnapshot, StatusStats } from '../../app/types'
import { SectionCard } from '../../shared/SectionCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type SharedRafListener = (timestamp: number) => void

const sharedRafListeners = new Set<SharedRafListener>()
let sharedRafId: number | null = null
const testNodeEnv = (globalThis as typeof globalThis & {
  process?: {
    env?: {
      NODE_ENV?: string
    }
  }
}).process?.env?.NODE_ENV
const canResetSharedRaf = testNodeEnv === 'test'

export function resetSharedRaf() {
  if (!canResetSharedRaf) {
    return
  }

  sharedRafListeners.clear()

  if (sharedRafId !== null) {
    cancelAnimationFrame(sharedRafId)
    sharedRafId = null
  }
}

function subscribeSharedRaf(listener: SharedRafListener) {
  sharedRafListeners.add(listener)

  if (sharedRafId === null) {
    sharedRafId = requestAnimationFrame(runSharedRaf)
  }

  return () => {
    sharedRafListeners.delete(listener)
    if (sharedRafListeners.size === 0 && sharedRafId !== null) {
      cancelAnimationFrame(sharedRafId)
      sharedRafId = null
    }
  }
}

function runSharedRaf(timestamp: number) {
  for (const listener of [...sharedRafListeners]) {
    try {
      listener(timestamp)
    } catch (error) {
      console.error('Shared RAF listener failed.', error)
    }
  }

  sharedRafId = sharedRafListeners.size > 0 ? requestAnimationFrame(runSharedRaf) : null
}

interface StatusOverviewProps {
  status: StatusSnapshot
  stats: StatusStats
  busy: boolean
  onToggleGlobal: () => void
  onRefresh: () => void
  onNavigate: (page: 'rules' | 'typing' | 'events' | 'settings') => void
  typingRuleCount: number
  processCount: number
}

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(target)

  useEffect(() => {
    const start = prevTarget.current
    if (start === target) {
      setValue(target)
      return
    }

    prevTarget.current = target

    const startTime = performance.now()
    let unsubscribe: () => void = () => {}

    unsubscribe = subscribeSharedRaf((now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(start + (target - start) * eased))
      if (progress >= 1) {
        unsubscribe()
      }
    })

    return unsubscribe
  }, [target, duration])

  return value
}

export function StatusOverview({
  status,
  stats,
  busy,
  onToggleGlobal,
  onRefresh,
  onNavigate,
  typingRuleCount,
  processCount,
}: StatusOverviewProps) {
  const rulesCount = useCountUp(status.totalRules)
  const activeCount = useCountUp(status.activeRules)
  const blockedCount = useCountUp(stats.blockedCount)
  const macroCount = useCountUp(typingRuleCount)
  const observedCount = useCountUp(stats.totalEvents)

  const maxBlocked = Math.max(1, ...stats.topBlocked.map((e) => e.count))
  const maxProcess = Math.max(1, ...stats.topProcesses.map((e) => e.count))
  const activeProtection = status.globalEnabled && status.hookActive
  const rulesLivePercent = status.totalRules > 0 ? Math.round((status.activeRules / status.totalRules) * 100) : 0
  const blockedShare = stats.totalEvents > 0 ? Math.round((stats.blockedCount / stats.totalEvents) * 100) : 0
  const statusHeading = activeProtection
    ? 'Protection is actively enforcing rules'
    : status.globalEnabled
      ? 'Protection is waiting for the hook to reconnect'
      : 'Protection is currently paused'
  const statusCopy = activeProtection
    ? 'Use this surface to confirm readiness, see live coverage, and move straight into the workflow that needs attention next.'
    : status.globalEnabled
      ? 'The runtime is armed, but the hook must reconnect before protection can intercept keyboard traffic again.'
      : 'Protection is intentionally paused. Resume the runtime to start enforcing live shortcut rules again.'
  const healthLabel = activeProtection ? 'Healthy' : status.globalEnabled ? 'Reconnecting' : 'Paused'
  const runtimeChips = [
    { label: 'Profile', value: status.activeProfile },
    { label: 'Tracked apps', value: `${processCount}` },
    { label: 'Port', value: `:${status.webDashboardPort}` },
  ]
  const runtimeSignals = [
    {
      label: 'Rules live',
      value: `${activeCount}/${rulesCount}`,
      detail: status.totalRules > 0 ? `${rulesLivePercent}% of configured rules are armed.` : 'Create a rule to start arming protection.',
      color: 'var(--cyan)',
    },
    {
      label: 'Observed events',
      value: `${observedCount}`,
      detail: stats.totalEvents > 0 ? 'Keyboard activity is flowing through the current session.' : 'Waiting for the first observed event.',
      color: 'var(--text)',
    },
    {
      label: 'Blocked share',
      value: stats.totalEvents > 0 ? `${blockedShare}%` : '0%',
      detail: stats.totalEvents > 0 ? `${blockedCount} blocked of ${observedCount} observed.` : 'Waiting for the first observed event.',
      color: 'var(--rose)',
    },
    {
      label: 'Typing macros',
      value: `${macroCount}`,
      detail: macroCount > 0 ? 'Hotkey macros are ready to fire from the automation workspace.' : 'Add a macro to automate high-frequency text.',
      color: 'var(--amber)',
    },
  ]
  const readinessRows = [
    {
      label: 'Hook handshake',
      value: status.hookActive ? 'Connected' : 'Inactive',
      detail: status.hookActive ? 'Keyboard interception is attached and listening.' : 'Protection cannot enforce until the hook reconnects.',
      progress: status.hookActive ? 100 : 14,
      color: status.hookActive ? 'var(--emerald)' : 'var(--rose)',
    },
    {
      label: 'Global state',
      value: status.globalEnabled ? 'Enforcing' : 'Paused',
      detail: status.globalEnabled ? 'Rules are allowed to block live shortcuts.' : 'Resume protection to reactivate enforcement.',
      progress: status.globalEnabled ? 100 : 0,
      color: status.globalEnabled ? 'var(--amber)' : 'var(--text-secondary)',
    },
    {
      label: 'Policy armament',
      value: `${activeCount}/${rulesCount}`,
      detail: status.totalRules > 0 ? `${rulesLivePercent}% of configured rules are active.` : 'No blocking rules are configured yet.',
      progress: rulesLivePercent,
      color: 'var(--cyan)',
    },
  ]
  const nextActions = [
    status.totalRules === 0
      ? {
          title: 'Create your first protection rule',
          description: 'Start by blocking the shortcut that causes the most confusion or risk.',
          page: 'rules' as const,
        }
      : {
          title: 'Refine scoped protection',
          description: 'Review existing rules and keep broad policies constrained to the apps that actually need them.',
          page: 'rules' as const,
        },
    typingRuleCount === 0
      ? {
          title: 'Add an automation macro',
          description: 'Create one high-value typing macro for support replies, signatures, or repeated snippets.',
          page: 'typing' as const,
        }
      : {
          title: 'Validate macro firing',
          description: 'Use the typing workspace to test hotkeys with a deliberate pre-delay before rollout.',
          page: 'typing' as const,
        },
    stats.blockedCount === 0 && status.totalRules > 0
      ? {
          title: 'Inspect event flow',
          description: 'The service is live but nothing has been blocked yet. Use the event log to confirm capture and refine scope.',
          page: 'events' as const,
        }
      : {
          title: 'Tune operating defaults',
          description: 'Check notifications, startup behavior, and retention so the app behaves the way your team expects.',
          page: 'settings' as const,
        },
  ]

  return (
    <SectionCard
      eyebrow="Operate"
      title="Control Center"
      subtitle="Run protection, automation, and diagnostics from one operational dashboard instead of a pile of disconnected settings screens."
      action={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={busy}>
            <RefreshCw className="size-4" />
            Refresh snapshot
          </Button>
          <Button type="button" onClick={onToggleGlobal} disabled={busy}>
            {status.globalEnabled ? 'Pause protection' : 'Resume protection'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="workspace-grid workspace-grid--dashboard">
          <div className="workspace-main">
            <div className="glass-panel p-4 md:p-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ui-eyebrow ui-eyebrow--accent inline-flex items-center gap-1.5">
                    <Shield className="size-3.5" />
                    Runtime state
                  </span>
                  <Badge variant={activeProtection ? 'success' : status.globalEnabled ? 'warning' : 'outline'}>
                    {healthLabel}
                  </Badge>
                  <Badge variant={status.globalEnabled ? 'secondary' : 'outline'}>
                    {status.globalEnabled ? 'Protection live' : 'Protection paused'}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <h3 className="m-0 text-lg font-semibold tracking-[-0.02em] md:text-[1.15rem]" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                    {statusHeading}
                  </h3>
                  <p className="m-0 max-w-2xl text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
                    {statusCopy}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {runtimeChips.map((chip) => (
                    <div key={chip.label} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.08em]">
                      <span style={{ color: 'var(--text-tertiary)' }}>{chip.label}</span>
                      <span className="font-semibold" style={{ color: chip.label === 'Port' ? 'var(--amber)' : 'var(--text)' }}>
                        {chip.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  {runtimeSignals.map((signal) => (
                    <article key={signal.label} className="glass-surface p-3.5">
                      <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {signal.label}
                      </p>
                      <strong className="mt-2 block text-lg font-semibold" style={{ color: signal.color }}>
                        {signal.value}
                      </strong>
                      <p className="m-0 mt-2 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                        {signal.detail}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-panel p-3.5 md:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    Process pressure
                  </p>
                  <p className="m-0 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    The apps producing the most observed keyboard traffic in this session.
                  </p>
                </div>
                <ScrollText className="size-4" style={{ color: 'var(--cyan)' }} />
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {stats.topProcesses.length === 0 ? (
                  <div className="empty-spotlight">
                    <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>No process activity yet.</p>
                    <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                      Open the event log once the hook is active to see which applications are producing traffic.
                    </p>
                  </div>
                ) : null}
                {stats.topProcesses.map((entry) => (
                  <div key={entry.process} className="glass-surface p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold font-mono" style={{ color: 'var(--amber)' }}>{entry.process}</span>
                      <strong className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{entry.count}</strong>
                    </div>
                    <div className="bar-chart-track">
                      <div className="bar-chart-fill" style={{ width: `${(entry.count / maxProcess) * 100}%`, background: 'var(--amber)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-3.5 md:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    Top blocked shortcuts
                  </p>
                  <p className="m-0 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    The shortcuts producing the most protection events right now.
                  </p>
                </div>
                <Keyboard className="size-4" style={{ color: 'var(--amber)' }} />
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {stats.topBlocked.length === 0 ? (
                  <div className="empty-spotlight">
                    <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>No blocked shortcuts yet.</p>
                    <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                      Once rules start catching traffic you will see the most active combinations here.
                    </p>
                  </div>
                ) : null}
                {stats.topBlocked.map((entry) => (
                  <div key={entry.shortcut} className="glass-surface p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold font-mono" style={{ color: 'var(--rose)' }}>{entry.shortcut}</span>
                      <strong className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{entry.count}</strong>
                    </div>
                    <div className="bar-chart-track">
                      <div className="bar-chart-fill" style={{ width: `${(entry.count / maxBlocked) * 100}%`, background: 'var(--rose)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="workspace-side workspace-side--dense">
            <div className="glass-panel p-4 md:p-5">
              <div className="space-y-5">
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        Runtime readiness
                      </p>
                      <p className="m-0 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Confirm that the hook, global state, and policy armament are aligned for live enforcement.
                      </p>
                    </div>
                    <Badge variant={activeProtection ? 'success' : status.globalEnabled ? 'warning' : 'outline'}>
                      {healthLabel}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {readinessRows.map((row) => (
                      <div key={row.label} className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="m-0 text-xs font-semibold" style={{ color: 'var(--text)' }}>{row.label}</p>
                            <p className="m-0 mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                              {row.detail}
                            </p>
                          </div>
                          <span className="text-sm font-semibold whitespace-nowrap" style={{ color: row.color }}>
                            {row.value}
                          </span>
                        </div>
                        <div className="bar-chart-track">
                          <div className="bar-chart-fill" style={{ width: `${row.progress}%`, background: row.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="shell-divider" />

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        Recommended next actions
                      </p>
                      <p className="m-0 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Move directly into the workflow that will tighten readiness or add the most value next.
                      </p>
                    </div>
                    <Badge variant="outline">{nextActions.length} queued</Badge>
                  </div>

                  <div className="space-y-2.5">
                    {nextActions.map((action) => (
                      <button
                        key={action.title}
                        type="button"
                        className="glass-surface flex w-full items-start justify-between gap-3.5 p-3.5 text-left transition-colors hover:border-[rgba(245,158,11,0.18)] hover:bg-[rgba(245,158,11,0.06)]"
                        onClick={() => onNavigate(action.page)}
                      >
                        <div>
                          <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>{action.title}</p>
                          <p className="m-0 mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>{action.description}</p>
                        </div>
                        <ArrowRight className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--amber)' }} />
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
