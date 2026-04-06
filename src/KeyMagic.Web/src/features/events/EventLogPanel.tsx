import { useDeferredValue, useMemo, useState } from 'react'
import type { ShortcutEvent } from '../../app/types'
import { ConfirmDialog } from '../../shared/ConfirmDialog'
import { SectionCard } from '../../shared/SectionCard'
import { Activity, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface EventLogPanelProps {
  events: ShortcutEvent[]
  busy: boolean
  onClear: () => Promise<void>
}

export function EventLogPanel({ events, busy, onClear }: EventLogPanelProps) {
  const [search, setSearch] = useState('')
  const [resultFilter, setResultFilter] = useState<'all' | 'blocked' | 'pass'>('all')
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)
  const searchQuery = deferredSearch.trim().toLowerCase()

  const blockedEvents = events.filter((event) => event.wasBlocked)
  const passedEvents = events.filter((event) => !event.wasBlocked)

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (resultFilter === 'blocked' && !event.wasBlocked) return false
      if (resultFilter === 'pass' && event.wasBlocked) return false

      if (!searchQuery) return true
      return [event.shortcutDisplay, event.processName, event.windowTitle, event.ruleId]
        .join(' ')
        .toLowerCase()
        .includes(searchQuery)
    })
  }, [events, resultFilter, searchQuery])

  const { topShortcuts, topProcesses } = useMemo(() => {
    const shortcutCounts = new Map<string, number>()
    const processCounts = new Map<string, number>()
    for (const event of filteredEvents) {
      shortcutCounts.set(event.shortcutDisplay, (shortcutCounts.get(event.shortcutDisplay) ?? 0) + 1)
      const processName = event.processName || 'Unknown process'
      processCounts.set(processName, (processCounts.get(processName) ?? 0) + 1)
    }
    const topShortcuts = [...shortcutCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5)
    const topProcesses = [...processCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5)
    return { topShortcuts, topProcesses }
  }, [filteredEvents])
  const uniqueProcesses = useMemo(() => new Set(events.map((event) => event.processName).filter(Boolean)).size, [events])
  const visibleBlockedCount = filteredEvents.filter((event) => event.wasBlocked).length
  const visiblePassedCount = filteredEvents.length - visibleBlockedCount
  const resultFilterLabel = resultFilter === 'all' ? 'All activity' : resultFilter === 'blocked' ? 'Blocked only' : 'Pass-through only'
  const searchSummary = deferredSearch.trim() || 'No search filter'

  async function handleClearEvents() {
    if (events.length === 0) return
    setClearError(null)

    try {
      await onClear()
      setClearDialogOpen(false)
    } catch (clearEventsError) {
      setClearDialogOpen(false)
      setClearError(clearEventsError instanceof Error ? clearEventsError.message : 'Failed to clear event history.')
    }
  }

  return (
    <SectionCard
      eyebrow="Observe"
      title="Event Log"
      subtitle="Turn raw keyboard activity into something you can inspect, filter, and use to validate whether protection is doing the right thing."
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => setClearDialogOpen(true)} disabled={busy || events.length === 0}>
          <Trash2 className="h-3.5 w-3.5" />
          Clear history
        </Button>
      }
    >
      <div className="space-y-5">
        {!busy && clearError ? <p className="error-text m-0">{clearError}</p> : null}

        <div className="insight-strip">
          <article className="metric-tile">
            <span className="metric-tile__eyebrow">Visible events</span>
            <strong className="metric-tile__value">{filteredEvents.length}</strong>
          </article>
          <article className="metric-tile">
            <span className="metric-tile__eyebrow">Blocked</span>
            <strong className="metric-tile__value" style={{ color: 'var(--rose)' }}>{blockedEvents.length}</strong>
          </article>
          <article className="metric-tile">
            <span className="metric-tile__eyebrow">Pass-through</span>
            <strong className="metric-tile__value" style={{ color: 'var(--emerald)' }}>{passedEvents.length}</strong>
          </article>
          <article className="metric-tile">
            <span className="metric-tile__eyebrow">Active apps</span>
            <strong className="metric-tile__value" style={{ color: 'var(--cyan)' }}>{uniqueProcesses}</strong>
          </article>
        </div>

        <div className="workspace-grid workspace-grid--diagnostic">
          <div className="workspace-main">
            <div className="toolbar-band">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by shortcut, app, window title, or rule id..." />
              <Badge variant="secondary">{filteredEvents.length} visible</Badge>
            </div>

            <div className="toolbar-band">
              <Button
                type="button"
                variant={resultFilter === 'all' ? 'info' : 'outline'}
                size="sm"
                onClick={() => setResultFilter('all')}
              >
                All activity
              </Button>
              <Button
                type="button"
                variant={resultFilter === 'blocked' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setResultFilter('blocked')}
              >
                Blocked only
              </Button>
              <Button
                type="button"
                variant={resultFilter === 'pass' ? 'success' : 'outline'}
                size="sm"
                onClick={() => setResultFilter('pass')}
              >
                Pass-through only
              </Button>
            </div>

            <div className="glass-panel overflow-hidden">
              <div className="flex flex-col gap-2 border-b border-[var(--glass-border)] px-4 py-3.5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    Diagnostic stream
                  </p>
                  <p className="m-0 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Filter the stream when you need to validate a shortcut, app scope, or unexpected pass-through behavior.
                  </p>
                </div>
                <Badge variant="outline">{resultFilterLabel}</Badge>
              </div>

              {filteredEvents.length === 0 ? (
                <div className="p-4">
                  <div className="empty-spotlight">
                    <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>No events match the current diagnostic view.</p>
                    <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                      Try clearing the filter or changing the result mode after generating fresh activity from the protection or automation workspaces.
                    </p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Shortcut</TableHead>
                      <TableHead className="hidden md:table-cell">Process</TableHead>
                      <TableHead className="hidden md:table-cell">Window</TableHead>
                      <TableHead>Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event, index) => (
                      <TableRow key={`${event.timestamp}-${event.ruleId}-${index}`}>
                        <TableCell>{new Date(event.timestamp).toLocaleTimeString()}</TableCell>
                        <TableCell className={event.wasBlocked ? 'text-rose-400' : undefined}>
                          <div className="space-y-1">
                            <div>{event.shortcutDisplay}</div>
                            <div className="space-y-1 text-xs md:hidden" style={{ color: 'var(--text-tertiary)' }}>
                              <div>{event.processName || 'Unknown process'}</div>
                              <div>{event.windowTitle || 'No active window title.'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{event.processName || '—'}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-[260px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0} className="interactive-truncate">
                                {event.windowTitle || '—'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{event.windowTitle || 'No active window title.'}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge variant={event.wasBlocked ? 'destructive' : 'success'}>
                            {event.wasBlocked ? 'Blocked' : 'Pass'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <div className="workspace-side workspace-side--dense">
            <div className="glass-panel space-y-4 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    Diagnostic rollup
                  </p>
                  <p className="m-0 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Keep the high-signal context close to the stream while you filter, inspect, and validate behavior.
                  </p>
                </div>
                <Badge variant="secondary">{resultFilterLabel}</Badge>
              </div>

              <div className="glass-surface space-y-3 p-3.5">
                <div className="ui-stat-row gap-4">
                  <span className="ui-stat-label">Search</span>
                  <span className="ui-stat-value--mono max-w-[15rem] truncate text-right" title={searchSummary}>{searchSummary}</span>
                </div>
                <div className="ui-stat-row gap-4">
                  <span className="ui-stat-label">Visible blocked</span>
                  <span className="ui-stat-value--mono" style={{ color: 'var(--rose)' }}>{visibleBlockedCount}</span>
                </div>
                <div className="ui-stat-row gap-4">
                  <span className="ui-stat-label">Visible pass-through</span>
                  <span className="ui-stat-value--mono" style={{ color: 'var(--emerald)' }}>{visiblePassedCount}</span>
                </div>
                <div className="ui-stat-row gap-4">
                  <span className="ui-stat-label">Active apps</span>
                  <span className="ui-stat-value--mono" style={{ color: 'var(--cyan)' }}>{uniqueProcesses}</span>
                </div>
              </div>

              <div className="shell-divider" />

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4" style={{ color: 'var(--amber)' }} />
                  <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>Top shortcuts in view</p>
                </div>
                {topShortcuts.length === 0 ? (
                  <div className="empty-spotlight">
                    <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>No shortcut data yet.</p>
                    <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                      Once activity is visible, the most frequent combinations appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topShortcuts.map(([shortcut, count]) => (
                      <div key={shortcut} className="glass-surface flex items-center justify-between gap-3 p-3">
                        <span className="text-xs font-bold font-mono" style={{ color: 'var(--text)' }}>{shortcut}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="shell-divider" />

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4" style={{ color: 'var(--cyan)' }} />
                  <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>Most active processes</p>
                </div>
                {topProcesses.length === 0 ? (
                  <div className="empty-spotlight">
                    <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>No process activity yet.</p>
                    <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                      Generate some keyboard activity and return here to see where most events are coming from.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topProcesses.map(([processName, count]) => (
                      <div key={processName} className="glass-surface flex items-center justify-between gap-3 p-3">
                        <span className="truncate text-xs font-bold font-mono" style={{ color: 'var(--text)' }}>{processName}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={clearDialogOpen}
        onOpenChange={(open) => {
          setClearDialogOpen(open)
          if (open) {
            setClearError(null)
          }
        }}
        title="Clear event history?"
        description="This removes the current event log from the dashboard so diagnostics start from a clean slate. This cannot be undone."
        confirmLabel="Clear history"
        confirmVariant="destructive"
        busy={busy}
        onConfirm={handleClearEvents}
      />
    </SectionCard>
  )
}
