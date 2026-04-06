import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { TextSource, type KeyMagicConfig, type SettingsUpdateInput, type StatusSnapshot } from '../../app/types'
import { ConfirmDialog } from '../../shared/ConfirmDialog'
import { FormField } from '../../shared/FormField'
import { SectionCard } from '../../shared/SectionCard'
import { Switch } from '../../components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidShortcut(value: unknown): boolean {
  return (
    isObjectRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.virtualKeyCode === 'number' &&
    typeof value.ctrl === 'boolean' &&
    typeof value.alt === 'boolean' &&
    typeof value.shift === 'boolean' &&
    typeof value.win === 'boolean'
  )
}

function isValidBlockingRule(value: unknown): boolean {
  return (
    isObjectRecord(value) &&
    typeof value.id === 'string' &&
    isValidShortcut(value.shortcut) &&
    Array.isArray(value.targetProcesses) &&
    value.targetProcesses.every((entry) => typeof entry === 'string') &&
    typeof value.enabled === 'boolean' &&
    typeof value.description === 'string' &&
    typeof value.createdAt === 'string'
  )
}

function isValidTypingRule(value: unknown): boolean {
  return (
    isObjectRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isValidShortcut(value.hotkey) &&
    (value.source === TextSource.FixedText || value.source === TextSource.Clipboard) &&
    typeof value.text === 'string' &&
    typeof value.interKeyDelayMs === 'number' &&
    typeof value.enabled === 'boolean' &&
    typeof value.createdAt === 'string'
  )
}

function isValidProfiles(value: unknown, validRuleIds: ReadonlySet<string>): value is KeyMagicConfig['profiles'] {
  return (
    isObjectRecord(value) &&
    Object.values(value).every(
      (entry) => Array.isArray(entry) && entry.every((item) => typeof item === 'string' && validRuleIds.has(item)),
    )
  )
}

function validateImportedConfig(config: unknown): config is KeyMagicConfig {
  const ruleIds = isObjectRecord(config) && Array.isArray(config.rules)
    ? new Set(config.rules.filter((rule) => isValidBlockingRule(rule)).map((rule) => rule.id))
    : new Set<string>()

  return (
    isObjectRecord(config) &&
    typeof config.globalEnabled === 'boolean' &&
    Array.isArray(config.rules) &&
    config.rules.every((rule) => isValidBlockingRule(rule)) &&
    typeof config.webDashboardPort === 'number' &&
    typeof config.showNotifications === 'boolean' &&
    typeof config.trayIconVisible === 'boolean' &&
    typeof config.logPassThrough === 'boolean' &&
    typeof config.allowSingleKeyBlocking === 'boolean' &&
    typeof config.maxLogEntries === 'number' &&
    typeof config.startWithWindows === 'boolean' &&
    typeof config.startEnabled === 'boolean' &&
    typeof config.activeProfile === 'string' &&
    isValidProfiles(config.profiles, ruleIds) &&
    typeof config.notificationSound === 'boolean' &&
    typeof config.notificationDurationMs === 'number' &&
    Array.isArray(config.typingRules) &&
    config.typingRules.every((rule) => isValidTypingRule(rule))
  )
}

interface SettingsFormState extends Omit<SettingsUpdateInput, 'maxLogEntries' | 'notificationDurationMs'> {
  maxLogEntries: string
  notificationDurationMs: string
}

interface SettingsPanelProps {
  status: StatusSnapshot
  busy: boolean
  onSave: (input: SettingsUpdateInput) => Promise<void>
  onExportConfig: () => Promise<void>
  onImportConfig: (config: KeyMagicConfig) => Promise<void>
}

function toSettingsForm(status: StatusSnapshot): SettingsFormState {
  return {
    showNotifications: status.showNotifications,
    trayIconVisible: status.trayIconVisible,
    logPassThrough: status.logPassThrough,
    allowSingleKeyBlocking: status.allowSingleKeyBlocking,
    maxLogEntries: String(status.maxLogEntries),
    startWithWindows: status.startWithWindows,
    startEnabled: status.startEnabled,
    notificationSound: status.notificationSound,
    notificationDurationMs: String(status.notificationDurationMs),
  }
}

export function SettingsPanel({ status, busy, onSave, onExportConfig, onImportConfig }: SettingsPanelProps) {
  const [form, setForm] = useState<SettingsFormState>(() => toSettingsForm(status))
  const [pendingImportConfig, setPendingImportConfig] = useState<KeyMagicConfig | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const settingsWorkspaceClassName = 'workspace-grid workspace-grid--balanced'

  async function handleFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    let config: KeyMagicConfig
    try {
      config = JSON.parse(await file.text()) as KeyMagicConfig
    } catch {
      toast.error('Invalid JSON — could not parse config file.')
      return
    }
    if (!validateImportedConfig(config)) {
      toast.error('Malformed config: missing or invalid top-level keys. Please export a config from KeyMagic and try again.')
      return
    }
    setPendingImportConfig(config)
  }

  useEffect(() => {
    setForm(toSettingsForm(status))
  }, [status])

  function updateForm<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function parseBoundedInteger(rawValue: string, label: string, min: number, max: number): number | null {
    if (rawValue.trim() === '') {
      toast.error(`${label} is required.`)
      return null
    }
    const parsed = Number.parseInt(rawValue, 10)
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      toast.error(`${label} must be between ${min} and ${max}.`)
      return null
    }
    return parsed
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const maxLogEntries = parseBoundedInteger(form.maxLogEntries, 'Max log entries', 10, 10000)
    if (maxLogEntries === null) return

    const notificationDurationMs = parseBoundedInteger(form.notificationDurationMs, 'Notification duration', 500, 30000)
    if (notificationDurationMs === null) return

    try {
      await onSave({
        ...form,
        maxLogEntries,
        notificationDurationMs,
      })
    } catch (e) {
      // Toast feedback is handled by the app mutation layer.
      console.error('SettingsPanel onSave error:', e)
    }
  }

  async function handleConfirmImport() {
    if (!pendingImportConfig) {
      return
    }

    try {
      await onImportConfig(pendingImportConfig)
      setPendingImportConfig(null)
    } catch (importError) {
      setPendingImportConfig(null)
      toast.error(importError instanceof Error ? importError.message : 'Import failed.')
    }
  }

  return (
    <SectionCard
      eyebrow="Configure"
      title="Settings"
      subtitle="Organize operating defaults by intent so protection, notifications, startup, and backups are easier to reason about at a glance."
      action={
        <Button type="submit" form="settings-form" disabled={busy}>
          Save changes
        </Button>
      }
    >
      <form id="settings-form" className="flex flex-col gap-5" onSubmit={(event) => void handleSubmit(event)}>
        <div className="insight-strip">
          <article className="metric-tile">
            <span className="metric-tile__eyebrow">Notifications</span>
            <strong className="metric-tile__value" style={{ color: form.showNotifications ? 'var(--amber)' : 'var(--text-secondary)' }}>
              {form.showNotifications ? 'On' : 'Off'}
            </strong>
          </article>
          <article className="metric-tile">
            <span className="metric-tile__eyebrow">Logging</span>
            <strong className="metric-tile__value" style={{ color: form.logPassThrough ? 'var(--cyan)' : 'var(--text-secondary)' }}>
              {form.logPassThrough ? 'Verbose' : 'Blocked only'}
            </strong>
          </article>
          <article className="metric-tile">
            <span className="metric-tile__eyebrow">Startup</span>
            <strong className="metric-tile__value" style={{ color: form.startWithWindows ? 'var(--emerald)' : 'var(--text-secondary)' }}>
              {form.startWithWindows ? 'Enabled' : 'Manual'}
            </strong>
          </article>
          <article className="metric-tile">
            <span className="metric-tile__eyebrow">Retention</span>
            <strong className="metric-tile__value" style={{ color: 'var(--text)' }}>{form.maxLogEntries}</strong>
          </article>
        </div>

        <Tabs defaultValue="protection" className="gap-4">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger className="sm:min-w-[8rem]" value="protection">Protection</TabsTrigger>
            <TabsTrigger className="sm:min-w-[8rem]" value="notifications">Notifications</TabsTrigger>
            <TabsTrigger className="sm:min-w-[8rem]" value="startup">Startup</TabsTrigger>
            <TabsTrigger className="sm:min-w-[8rem]" value="retention">Retention</TabsTrigger>
            <TabsTrigger className="sm:min-w-[8rem]" value="configuration">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="protection" className="space-y-4">
            <div className={settingsWorkspaceClassName}>
              <div className="workspace-main">
                <div className="settings-group">
                  <h3 className="settings-group__title">Protection behavior</h3>
                  <div className="settings-row">
                    <div>
                      <p className="settings-row__label m-0">Single-key blocking</p>
                      <p className="settings-row__sublabel m-0">Allow rules that block a single key without modifiers.</p>
                    </div>
                    <Switch checked={form.allowSingleKeyBlocking} onCheckedChange={(checked) => updateForm('allowSingleKeyBlocking', checked)} />
                  </div>
                  <div className="settings-row">
                    <div>
                      <p className="settings-row__label m-0">Log pass-through</p>
                      <p className="settings-row__sublabel m-0">Record non-blocked events for troubleshooting and validation.</p>
                    </div>
                    <Switch checked={form.logPassThrough} onCheckedChange={(checked) => updateForm('logPassThrough', checked)} />
                  </div>
                </div>
              </div>

              <div className="workspace-side">
                <div className="advisory-card">
                  <div className="advisory-card__body">
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      Recommended posture
                    </p>
                    <p className="m-0 text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
                      Keep single-key blocking off unless there is a specific operational need. It is powerful, but it can also surprise users if applied too broadly.
                    </p>
                  </div>
                  <div className="advisory-card__footer">
                    <Badge variant={form.allowSingleKeyBlocking ? 'secondary' : 'outline'}>
                      {form.allowSingleKeyBlocking ? 'High control mode' : 'Safer default mode'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <div className={settingsWorkspaceClassName}>
              <div className="workspace-main">
                <div className="settings-group">
                  <h3 className="settings-group__title">Notification experience</h3>
                  <div className="settings-row">
                    <div>
                      <p className="settings-row__label m-0">Show notifications</p>
                      <p className="settings-row__sublabel m-0">Display a toast when shortcuts are blocked.</p>
                    </div>
                    <Switch checked={form.showNotifications} onCheckedChange={(checked) => updateForm('showNotifications', checked)} />
                  </div>
                  <div className="settings-row">
                    <div>
                      <p className="settings-row__label m-0">Notification sound</p>
                      <p className="settings-row__sublabel m-0">Play an audible cue when protection intervenes.</p>
                    </div>
                    <Switch checked={form.notificationSound} onCheckedChange={(checked) => updateForm('notificationSound', checked)} />
                  </div>
                  <div className="settings-row">
                    <div>
                      <p className="settings-row__label m-0">Tray icon visible</p>
                      <p className="settings-row__sublabel m-0">Keep the service visible in the system tray.</p>
                    </div>
                    <Switch checked={form.trayIconVisible} onCheckedChange={(checked) => updateForm('trayIconVisible', checked)} />
                  </div>
                </div>
              </div>

              <div className="workspace-side">
                <div className="glass-panel p-4">
                  <FormField
                    label="Notification duration"
                    description="Use a shorter duration for ambient reminders or a longer one when users need time to read the message."
                    hint="Allowed range: 500ms to 30000ms."
                  >
                    <Input
                      type="number"
                      min={500}
                      max={30000}
                      value={form.notificationDurationMs}
                      onChange={(event) => updateForm('notificationDurationMs', event.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="startup" className="space-y-4">
            <div className={settingsWorkspaceClassName}>
              <div className="workspace-main">
                <div className="settings-group">
                  <h3 className="settings-group__title">Startup behavior</h3>
                  <div className="settings-row">
                    <div>
                      <p className="settings-row__label m-0">Start with Windows</p>
                      <p className="settings-row__sublabel m-0">Launch KeyMagic automatically at system boot.</p>
                    </div>
                    <Switch checked={form.startWithWindows} onCheckedChange={(checked) => updateForm('startWithWindows', checked)} />
                  </div>
                  <div className="settings-row">
                    <div>
                      <p className="settings-row__label m-0">Start enabled</p>
                      <p className="settings-row__sublabel m-0">Begin enforcing rules immediately when the app starts.</p>
                    </div>
                    <Switch checked={form.startEnabled} onCheckedChange={(checked) => updateForm('startEnabled', checked)} />
                  </div>
                </div>
              </div>

              <div className="workspace-side">
                <div className="advisory-card">
                  <div className="advisory-card__body">
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      Startup guidance
                    </p>
                    <p className="m-0 text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
                      Enabling both startup options is best for kiosk or managed-device scenarios. Leave them manual when you need change control or staged rollouts.
                    </p>
                  </div>
                  <div className="advisory-card__footer">
                    <Badge variant={form.startWithWindows && form.startEnabled ? 'default' : 'outline'}>
                      {form.startWithWindows && form.startEnabled ? 'Hands-off startup' : 'Manual startup'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="retention" className="space-y-4">
            <div className={settingsWorkspaceClassName}>
              <div className="workspace-main">
                <div className="glass-panel p-4 md:p-5">
                  <FormField
                    label="Max log entries"
                    description="Oldest items are discarded first when the limit is reached."
                    hint="Allowed range: 10 to 10000."
                  >
                    <Input
                      type="number"
                      min={10}
                      max={10000}
                      value={form.maxLogEntries}
                      onChange={(event) => updateForm('maxLogEntries', event.target.value)}
                    />
                  </FormField>
                </div>
              </div>

              <div className="workspace-side">
                <div className="advisory-card">
                  <div className="advisory-card__body">
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      Observability tradeoff
                    </p>
                    <p className="m-0 text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
                      Higher retention gives better forensic context but increases noise in the event workspace. Tune it around how frequently operators actually review diagnostics.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="configuration" className="space-y-4">
            <div className={settingsWorkspaceClassName}>
              <div className="workspace-main">
                <div className="settings-group">
                  <h3 className="settings-group__title">Backup and restore</h3>
                  <div className="settings-row">
                    <div>
                      <p className="settings-row__label m-0">Export config</p>
                      <p className="settings-row__sublabel m-0">Download the full configuration as JSON for backup or rollout.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => void onExportConfig()} disabled={busy}>
                      Export
                    </Button>
                  </div>
                  <div className="settings-row">
                    <div>
                      <p className="settings-row__label m-0">Import config</p>
                      <p className="settings-row__sublabel m-0">Replace the current configuration from a JSON backup.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                      Import
                    </Button>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => void handleFileImport(e)} />
                </div>
              </div>

              <div className="workspace-side">
                <div className="glass-panel space-y-3 p-4">
                  <div>
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      System context
                    </p>
                  </div>
                  <div className="glass-surface p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span style={{ color: 'var(--text-tertiary)' }}>Dashboard port</span>
                      <span className="font-bold font-mono" style={{ color: 'var(--cyan)' }}>:{status.webDashboardPort}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span style={{ color: 'var(--text-tertiary)' }}>Active profile</span>
                      <span className="font-bold font-mono" style={{ color: 'var(--amber)' }}>{status.activeProfile}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span style={{ color: 'var(--text-tertiary)' }}>Profiles available</span>
                      <span className="font-bold font-mono" style={{ color: 'var(--text)' }}>{status.profiles.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="toolbar-band flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
            These defaults shape how the service feels in day-to-day use. Save changes after reviewing the tabs that matter for your rollout stage.
          </p>
          <Button type="submit" disabled={busy}>
            Save changes
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pendingImportConfig !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingImportConfig(null)
          }
        }}
        title="Replace current configuration?"
        description="Importing this file will overwrite the current configuration state. This cannot be undone from the dashboard."
        confirmLabel="Replace configuration"
        confirmVariant="destructive"
        busy={busy}
        onConfirm={handleConfirmImport}
      />
    </SectionCard>
  )
}
