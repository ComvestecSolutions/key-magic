import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from './api'
import {
  BatchCreateBlockingRulesInput,
  BatchUpdateBlockingRulesInput,
  CreateBlockingRuleInput,
  CreateTypingRuleInput,
  DashboardSnapshot,
  KeyMagicConfig,
  SettingsUpdateInput,
  TextSource,
  TypingRule,
  UpdateBlockingRuleInput,
  UpdateTypingRuleInput,
} from './types'
import { EventLogPanel } from '../features/events/EventLogPanel'
import { BlockingRulesPanel } from '../features/rules/BlockingRulesPanel'
import { SettingsPanel } from '../features/settings/SettingsPanel'
import { StatusOverview } from '../features/status/StatusOverview'
import { TypingRulesPanel } from '../features/typing/TypingRulesPanel'
import { AppIcon } from '../shared/AppIcon'
import { cn } from '@/lib/utils'
import { Shield, Activity, Cog, Type, ScrollText, RefreshCw, Menu, X } from 'lucide-react'

type PageId = 'overview' | 'rules' | 'typing' | 'events' | 'settings'

interface NavItem {
  id: PageId
  label: string
  shortLabel: string
  eyebrow: string
  summary: string
  group: 'Operate' | 'Build' | 'Observe' | 'Configure'
  icon: typeof Activity
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Home',
    eyebrow: 'Operate',
    summary: 'Service posture, activity, and next actions.',
    group: 'Operate',
    icon: Activity,
  },
  {
    id: 'rules',
    label: 'Blocking Rules',
    shortLabel: 'Protect',
    eyebrow: 'Protection',
    summary: 'Build focused shortcut policies for all apps or selected processes.',
    group: 'Build',
    icon: Shield,
  },
  {
    id: 'typing',
    label: 'Typing Macros',
    shortLabel: 'Automate',
    eyebrow: 'Automation',
    summary: 'Compose repeatable hotkey macros that type fixed or clipboard text.',
    group: 'Build',
    icon: Type,
  },
  {
    id: 'events',
    label: 'Event Log',
    shortLabel: 'Events',
    eyebrow: 'Observe',
    summary: 'Inspect blocked and pass-through activity to validate rule behavior.',
    group: 'Observe',
    icon: ScrollText,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    eyebrow: 'Configure',
    summary: 'Tune startup, notifications, retention, and configuration handling.',
    group: 'Configure',
    icon: Cog,
  },
]

const NAV_GROUPS: Array<{ label: NavItem['group']; items: PageId[] }> = [
  { label: 'Operate', items: ['overview'] },
  { label: 'Build', items: ['rules', 'typing'] },
  { label: 'Observe', items: ['events'] },
  { label: 'Configure', items: ['settings'] },
]

const LIVE_REFRESH_INTERVAL_MS = 2500

export function App() {
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<PageId>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pageKey, setPageKey] = useState(0)
  const latestRefreshId = useRef(0)
  const refreshInFlightCount = useRef(0)
  const busyLabelRef = useRef<string | null>(null)
  const hasDashboardRef = useRef(false)
  const hasDashboard = dashboard !== null

  const refreshDashboard = useCallback(async (mode: 'initial' | 'manual' | 'silent' = 'manual') => {
    if (mode === 'silent' && refreshInFlightCount.current > 0) {
      return
    }

    const refreshId = ++latestRefreshId.current
    refreshInFlightCount.current += 1

    if (mode === 'initial') setLoading(true)
    else if (mode === 'manual') setRefreshing(true)

    try {
      const snapshot = await api.getDashboard()
      if (refreshId !== latestRefreshId.current) return
      setDashboard(snapshot)
      setError(null)
    } catch (refreshError) {
      if (refreshId !== latestRefreshId.current) return
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load dashboard data.')
    } finally {
      refreshInFlightCount.current = Math.max(0, refreshInFlightCount.current - 1)

      if (refreshId === latestRefreshId.current) {
        if (mode === 'initial') setLoading(false)
        else if (mode === 'manual') setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void refreshDashboard('initial')
  }, [refreshDashboard])

  useEffect(() => {
    busyLabelRef.current = busyLabel
  }, [busyLabel])

  useEffect(() => {
    hasDashboardRef.current = hasDashboard
  }, [hasDashboard])

  useEffect(() => {
    if (!sidebarOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    if (window.innerWidth < 768) {
      document.body.style.overflow = 'hidden'
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [sidebarOpen])

  const refreshIfVisible = useCallback(() => {
    if (document.visibilityState !== 'visible' || busyLabelRef.current || !hasDashboardRef.current) {
      return
    }
    void refreshDashboard('silent')
  }, [refreshDashboard])

  useEffect(() => {
    if (!hasDashboard) {
      return undefined
    }
    const intervalId = window.setInterval(refreshIfVisible, LIVE_REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [hasDashboard, refreshIfVisible])

  function navigateTo(page: PageId) {
    if (page !== activePage) {
      setActivePage(page)
      setPageKey((k) => k + 1)
    }
    setSidebarOpen(false)
  }

  async function runMutation(label: string, action: () => Promise<unknown>, successMessage: string, options?: { rethrowOnError?: boolean }) {
    setBusyLabel(label)
    setError(null)
    try {
      await action()
      toast.success(successMessage)
      await refreshDashboard('silent')
    } catch (mutationError) {
      const msg = mutationError instanceof Error ? mutationError.message : label + ' failed.'
      toast.error(msg)
      if (options?.rethrowOnError) throw mutationError
    } finally {
      setBusyLabel(null)
    }
  }

  async function handleCreateRule(input: CreateBlockingRuleInput) {
    await runMutation('Creating blocking rule', () => api.createRule(input), 'Added blocking rule ' + input.displayName, { rethrowOnError: true })
  }
  async function handleToggleRule(id: string) { await runMutation('Toggling', () => api.toggleRule(id), 'Updated blocking rule state') }
  async function handleDeleteRule(id: string) { await runMutation('Deleting', () => api.deleteRule(id), 'Deleted blocking rule', { rethrowOnError: true }) }
  async function handleBatchCreateRules(input: BatchCreateBlockingRulesInput) {
    await runMutation('Batch creating rules', () => api.batchCreateRules(input), `Created ${input.shortcuts.length} blocking rules`, { rethrowOnError: true })
  }
  async function handleBatchUpdateRules(input: BatchUpdateBlockingRulesInput) {
    await runMutation('Batch updating rules', () => api.batchUpdateRules(input), `Updated ${input.ids.length} blocking rules`, { rethrowOnError: true })
  }
  async function handleBatchToggleRules(ids: string[], enabled: boolean) {
    await runMutation('Batch toggling rules', () => api.batchToggleRules(ids, enabled), `${enabled ? 'Enabled' : 'Disabled'} ${ids.length} blocking rules`, { rethrowOnError: true })
  }
  async function handleBatchDeleteRules(ids: string[]) {
    await runMutation('Batch deleting rules', () => api.batchDeleteRules(ids), `Deleted ${ids.length} blocking rules`, { rethrowOnError: true })
  }
  async function handleCreateTypingRule(input: CreateTypingRuleInput) { await runMutation('Creating typing rule', () => api.createTypingRule(input), 'Added typing rule', { rethrowOnError: true }) }
  async function handleToggleTypingRule(id: string) { await runMutation('Toggling', () => api.toggleTypingRule(id), 'Updated typing rule state') }
  async function handleDeleteTypingRule(id: string) { await runMutation('Deleting', () => api.deleteTypingRule(id), 'Deleted typing rule') }
  async function handleFireTypingRule(rule: TypingRule, preDelayMs: number) {
    await runMutation('Queueing', async () => {
      const text = rule.source === TextSource.Clipboard ? await navigator.clipboard.readText() : undefined
      await api.fireTypingRule(rule.id, { text, preDelayMs })
    }, 'Queued typed text')
  }
  async function handleClearEvents() { await runMutation('Clearing events', () => api.clearEvents(), 'Cleared event history', { rethrowOnError: true }) }
  async function handleSaveSettings(input: SettingsUpdateInput) { await runMutation('Saving settings', () => api.updateSettings(input), 'Saved settings', { rethrowOnError: true }) }
  async function handleToggleGlobal() { await runMutation('Toggling global', () => api.toggleGlobal(), 'Updated global blocking state') }

  async function handleUpdateRule(id: string, input: UpdateBlockingRuleInput) { await runMutation('Updating rule', () => api.updateRule(id, input), 'Updated blocking rule', { rethrowOnError: true }) }
  async function handleUpdateTypingRule(id: string, input: UpdateTypingRuleInput) { await runMutation('Updating typing rule', () => api.updateTypingRule(id, input), 'Updated typing rule', { rethrowOnError: true }) }

  async function handleExportConfig() {
    setBusyLabel('Exporting')
    try {
      const config = await api.exportConfig()
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'keymagic-config.json'
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Config exported')
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Export failed.')
    } finally {
      setBusyLabel(null)
    }
  }

  async function handleImportConfig(config: KeyMagicConfig) { await runMutation('Importing config', () => api.importConfig(config), 'Configuration imported successfully') }

  const handleRefresh = useCallback(() => void refreshDashboard('manual'), [])

  /* ── Loading State ── */
  if (loading && !dashboard) {
    return (
      <div className="loading-screen">
        <div className="flex flex-col items-center gap-6">
          <AppIcon size={72} animated />
          <div className="flex flex-col items-center gap-2">
            <h1 className="ui-heading-display">
              KeyMagic
            </h1>
            <p className="ui-copy-xs ui-mono ui-text-tertiary">
              Connecting to service...
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ── Error / Offline State ── */
  if (!dashboard) {
    return (
      <div className="loading-screen">
        <div className="glass-card flex max-w-[420px] flex-col items-center gap-5 p-10">
          <Shield className="h-14 w-14 ui-text-rose" />
          <h1 className="ui-heading-display">Dashboard Offline</h1>
          <p className="ui-copy text-center">{error ?? 'Service returned no data.'}</p>
          <Button onClick={() => void refreshDashboard('initial')}>Retry Connection</Button>
        </div>
      </div>
    )
  }

  const busy = loading || refreshing || busyLabel !== null
  const activeNavItem = NAV_ITEMS.find((n) => n.id === activePage)!
  const ActivePageIcon = activeNavItem.icon

  const pageCounts: Partial<Record<PageId, number>> = {
    overview: dashboard.events.length,
    rules: dashboard.rules.length,
    typing: dashboard.typingRules.length,
    events: dashboard.events.length,
  }

  function renderPage() {
    switch (activePage) {
      case 'overview':
        return (
          <StatusOverview
            status={dashboard!.status}
            stats={dashboard!.stats}
            busy={busy}
            onToggleGlobal={handleToggleGlobal}
            onRefresh={handleRefresh}
            typingRuleCount={dashboard!.typingRules.length}
            processCount={dashboard!.processes.length}
            onNavigate={navigateTo}
          />
        )
      case 'rules':
        return (
          <BlockingRulesPanel
            rules={dashboard!.rules}
            processes={dashboard!.processes}
            busy={busy}
            onCreate={handleCreateRule}
            onUpdate={handleUpdateRule}
            onBatchCreate={handleBatchCreateRules}
            onBatchUpdate={handleBatchUpdateRules}
            onBatchToggle={handleBatchToggleRules}
            onBatchDelete={handleBatchDeleteRules}
            onToggle={handleToggleRule}
            onDelete={handleDeleteRule}
          />
        )
      case 'typing':
        return (
          <TypingRulesPanel
            rules={dashboard!.typingRules}
            busy={busy}
            onCreate={handleCreateTypingRule}
            onUpdate={handleUpdateTypingRule}
            onToggle={handleToggleTypingRule}
            onDelete={handleDeleteTypingRule}
            onFire={handleFireTypingRule}
          />
        )
      case 'events':
        return (
          <EventLogPanel
            events={dashboard!.events}
            busy={busy}
            onClear={handleClearEvents}
          />
        )
      case 'settings':
        return (
          <SettingsPanel
            status={dashboard!.status}
            busy={busy}
            onSave={handleSaveSettings}
            onExportConfig={handleExportConfig}
            onImportConfig={handleImportConfig}
          />
        )
    }
  }

  return (
    <div className="relative flex min-h-screen w-full ui-text-primary">
      <Toaster
        position="bottom-center"
        richColors
        offset={{ bottom: 24 }}
        mobileOffset={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.75rem)' }}
      />

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <button
          type="button"
          className="shell-menu-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside id="primary-navigation" aria-label="Primary navigation" className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="px-5 pt-6 pb-5">
            <div className="flex items-center gap-3">
              <AppIcon size={38} />
              <div>
                <h2 className="ui-shell-title">
                  KeyMagic
                </h2>
                <p className="ui-eyebrow ui-eyebrow--tight ui-eyebrow--accent">
                  Control Plane
                </p>
              </div>
            </div>
            <p className="ui-copy-xs mt-4">
              Build focused keyboard protection, automation, and diagnostics from one desktop-first workspace.
            </p>
          </div>

          <div className="shell-divider mx-4 mb-3" />

          <div className="flex flex-1 flex-col gap-5 px-3 pb-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="ui-eyebrow ui-eyebrow--tight px-2">
                  {group.label}
                </p>
                <nav className="flex flex-col gap-1" aria-label={group.label}>
                  {group.items.map((pageId) => {
                    const item = NAV_ITEMS.find((navItem) => navItem.id === pageId)!
                    const Icon = item.icon
                    const isActive = activePage === item.id
                    const count = pageCounts[item.id]

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateTo(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`sidebar-nav-btn ${isActive ? 'sidebar-nav-btn--active' : ''}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span>{item.label}</span>
                            {typeof count === 'number' ? (
                              <span className="shell-count-pill">
                                {count}
                              </span>
                            ) : null}
                          </div>
                          <span className="mt-1 block text-[11px] leading-4 ui-text-tertiary">
                            {item.summary}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </nav>
              </div>
            ))}
          </div>

        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-[260px]">

        {/* Top Bar */}
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="shell-menu-button"
              aria-controls="primary-navigation"
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="min-w-0 space-y-1">
              <p className="ui-eyebrow ui-eyebrow--tight">
                {activeNavItem.eyebrow}
              </p>
              <div className="flex min-w-0 items-center gap-2.5">
                <ActivePageIcon className="h-4.5 w-4.5 shrink-0 ui-text-amber" />
                <div className="min-w-0">
                  <h1 className="ui-shell-title truncate">
                    {activeNavItem.label}
                  </h1>
                  <p className="ui-copy-xs hidden truncate sm:block">
                    {activeNavItem.summary}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Badge
              variant={dashboard.status.hookActive ? 'secondary' : 'outline'}
              className="hidden md:inline-flex gap-1.5"
              aria-live="polite"
            >
              <span
                className={cn(
                  'inline-flex h-1.5 w-1.5 rounded-full',
                  dashboard.status.hookActive ? 'bg-[var(--emerald)]' : 'bg-[var(--rose)]'
                )}
              />
              {dashboard.status.hookActive ? 'Hook active' : 'Hook inactive'}
            </Badge>

            {busyLabel || refreshing ? (
              <Badge variant="secondary" className="hidden sm:inline-flex" aria-live="polite">
                {busyLabel ?? 'Syncing dashboard'}
              </Badge>
            ) : (
              <Badge variant="outline" className="hidden lg:inline-flex">
                Live updates
              </Badge>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshDashboard('manual')}
              disabled={busy}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden text-xs sm:inline">Sync now</span>
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="relative z-[1] flex-1 overflow-y-auto px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
            <div key={pageKey} className="page-transition">
              {renderPage()}
            </div>
          </div>
        </main>
      </div>

      {/* ── Bottom Tab Bar (Mobile) ── */}
      <nav className="bottom-tabs" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={`bottom-tab-btn ${isActive ? 'bottom-tab-btn--active' : ''}`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.shortLabel}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

