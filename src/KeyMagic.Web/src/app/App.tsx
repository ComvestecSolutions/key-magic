import { startTransition, useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { CreateBlockingRuleInput, CreateTypingRuleInput, DashboardSnapshot, SettingsUpdateInput, TypingRule } from './types'
import { EventLogPanel } from '../features/events/EventLogPanel'
import { BlockingRulesPanel } from '../features/rules/BlockingRulesPanel'
import { SettingsPanel } from '../features/settings/SettingsPanel'
import { StatusOverview } from '../features/status/StatusOverview'
import { TypingRulesPanel } from '../features/typing/TypingRulesPanel'

export function App() {
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>('Local dashboard connected to the Key Magic service API.')
  const latestRefreshId = useRef(0)

  useEffect(() => {
    void refreshDashboard(true)
  }, [])

  async function refreshDashboard(showLoadingState = false) {
    const refreshId = ++latestRefreshId.current

    if (showLoadingState) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const snapshot = await api.getDashboard()

      if (refreshId !== latestRefreshId.current) {
        return
      }

      startTransition(() => {
        setDashboard(snapshot)
        setError(null)
      })
    } catch (refreshError) {
      if (refreshId !== latestRefreshId.current) {
        return
      }

      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load dashboard data.')
    } finally {
      if (refreshId !== latestRefreshId.current) {
        return
      }

      if (showLoadingState) {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }

  async function runMutation(
    label: string,
    action: () => Promise<unknown>,
    successMessage: string,
    options?: { rethrowOnError?: boolean },
  ) {
    setBusyLabel(label)
    setError(null)

    try {
      await action()
      setMessage(successMessage)
      await refreshDashboard(false)
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : `${label} failed.`)

      if (options?.rethrowOnError) {
        throw mutationError
      }
    } finally {
      setBusyLabel(null)
    }
  }

  async function handleCreateRule(input: CreateBlockingRuleInput) {
    await runMutation('Creating blocking rule', () => api.createRule(input), `Added blocking rule ${input.displayName}.`, { rethrowOnError: true })
  }

  async function handleToggleRule(id: string) {
    await runMutation('Toggling blocking rule', () => api.toggleRule(id), 'Updated blocking rule state.')
  }

  async function handleDeleteRule(id: string) {
    await runMutation('Deleting blocking rule', () => api.deleteRule(id), 'Deleted blocking rule.')
  }

  async function handleCreateTypingRule(input: CreateTypingRuleInput) {
    await runMutation('Creating typing rule', () => api.createTypingRule(input), `Added typing rule ${input.name}.`, { rethrowOnError: true })
  }

  async function handleToggleTypingRule(id: string) {
    await runMutation('Toggling typing rule', () => api.toggleTypingRule(id), 'Updated typing rule state.')
  }

  async function handleDeleteTypingRule(id: string) {
    await runMutation('Deleting typing rule', () => api.deleteTypingRule(id), 'Deleted typing rule.')
  }

  async function handleFireTypingRule(rule: TypingRule, preDelayMs: number) {
    await runMutation(
      'Queueing typing rule',
      async () => {
        const text = rule.source === 1 ? await navigator.clipboard.readText() : undefined
        await api.fireTypingRule(rule.id, { text, preDelayMs })
      },
      `Queued ${rule.name || rule.hotkey.displayName}.`,
    )
  }

  async function handleClearEvents() {
    await runMutation('Clearing events', () => api.clearEvents(), 'Cleared event history.')
  }

  async function handleSaveSettings(input: SettingsUpdateInput) {
    await runMutation('Saving settings', () => api.updateSettings(input), 'Saved dashboard settings.', { rethrowOnError: true })
  }

  async function handleToggleGlobal() {
    await runMutation('Toggling global state', () => api.toggleGlobal(), 'Updated global blocking state.')
  }

  if (loading && !dashboard) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__card">
          <p className="eyebrow">Key Magic</p>
          <h1>Connecting to the local keyboard service</h1>
          <p>Checking rule state, recent activity, and runtime health.</p>
        </div>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__card">
          <p className="eyebrow">Key Magic</p>
          <h1>Dashboard unavailable</h1>
          <p>{error ?? 'The service did not return dashboard data.'}</p>
          <button type="button" className="primary-button" onClick={() => void refreshDashboard(true)}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  const busy = loading || refreshing || busyLabel !== null

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <p className="eyebrow">Keyboard orchestration</p>
        <h1>Key Magic</h1>
        <p className="sidebar-copy">
          One local surface for shortcut blocking, typing automation, and operational visibility across the Windows apps that keep stealing keystrokes.
        </p>

        <div className="sidebar-stack">
          <div className="sidebar-panel">
            <span>Active profile</span>
            <strong>{dashboard.status.activeProfile}</strong>
            <small>{dashboard.status.profiles.join(', ')}</small>
          </div>
          <div className="sidebar-panel">
            <span>Known processes</span>
            <strong>{dashboard.processes.length}</strong>
            <small>Live app targets available for scoped rules.</small>
          </div>
          <div className="sidebar-panel">
            <span>Runtime</span>
            <strong>{busyLabel ?? (refreshing ? 'Refreshing dashboard' : 'Idle')}</strong>
            <small>{dashboard.status.hookActive ? 'Keyboard hook is active.' : 'Keyboard hook is currently inactive.'}</small>
          </div>
        </div>

        {message ? <p className="notice notice--info">{message}</p> : null}
        {error ? <p className="notice notice--error">{error}</p> : null}
      </aside>

      <main className="app-main">
        <StatusOverview status={dashboard.status} stats={dashboard.stats} busy={busy} onToggleGlobal={handleToggleGlobal} onRefresh={() => void refreshDashboard(false)} />
        <div className="dashboard-grid">
          <BlockingRulesPanel
            rules={dashboard.rules}
            processes={dashboard.processes}
            busy={busy}
            onCreate={handleCreateRule}
            onToggle={handleToggleRule}
            onDelete={handleDeleteRule}
          />
          <TypingRulesPanel
            rules={dashboard.typingRules}
            busy={busy}
            onCreate={handleCreateTypingRule}
            onToggle={handleToggleTypingRule}
            onDelete={handleDeleteTypingRule}
            onFire={handleFireTypingRule}
          />
          <EventLogPanel events={dashboard.events} busy={busy} onClear={handleClearEvents} />
          <SettingsPanel status={dashboard.status} busy={busy} onSave={handleSaveSettings} />
        </div>
      </main>
    </div>
  )
}
