import { useEffect, useState, type FormEvent } from 'react'
import type { SettingsUpdateInput, StatusSnapshot } from '../../app/types'
import { SectionCard } from '../../shared/SectionCard'

interface SettingsPanelProps {
  status: StatusSnapshot
  busy: boolean
  onSave: (input: SettingsUpdateInput) => Promise<void>
}

function toSettings(status: StatusSnapshot): SettingsUpdateInput {
  return {
    showNotifications: status.showNotifications,
    trayIconVisible: status.trayIconVisible,
    logPassThrough: status.logPassThrough,
    allowSingleKeyBlocking: status.allowSingleKeyBlocking,
    maxLogEntries: status.maxLogEntries,
    startWithWindows: status.startWithWindows,
    startEnabled: status.startEnabled,
    notificationSound: status.notificationSound,
    notificationDurationMs: status.notificationDurationMs,
  }
}

export function SettingsPanel({ status, busy, onSave }: SettingsPanelProps) {
  const [form, setForm] = useState<SettingsUpdateInput>(() => toSettings(status))

  useEffect(() => {
    setForm(toSettings(status))
  }, [status])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSave(form)
  }

  return (
    <SectionCard title="Settings" subtitle="Tune notifications, retention, and startup behavior without leaving the keyboard stack.">
      <form className="editor-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="toggle-grid">
          <label className="inline-toggle"><input type="checkbox" checked={form.showNotifications} onChange={(event) => setForm({ ...form, showNotifications: event.target.checked })} />Show notifications</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.trayIconVisible} onChange={(event) => setForm({ ...form, trayIconVisible: event.target.checked })} />Tray icon visible</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.logPassThrough} onChange={(event) => setForm({ ...form, logPassThrough: event.target.checked })} />Log pass-through events</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.allowSingleKeyBlocking} onChange={(event) => setForm({ ...form, allowSingleKeyBlocking: event.target.checked })} />Allow single-key blocking</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.startWithWindows} onChange={(event) => setForm({ ...form, startWithWindows: event.target.checked })} />Start with Windows</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.startEnabled} onChange={(event) => setForm({ ...form, startEnabled: event.target.checked })} />Start enabled</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.notificationSound} onChange={(event) => setForm({ ...form, notificationSound: event.target.checked })} />Notification sound</label>
        </div>

        <div className="form-row form-row--split">
          <label>
            <span>Max log entries</span>
            <input type="number" min={10} max={10000} value={form.maxLogEntries} onChange={(event) => setForm({ ...form, maxLogEntries: Number(event.target.value) })} />
          </label>
          <label>
            <span>Notification duration (ms)</span>
            <input type="number" min={500} max={30000} value={form.notificationDurationMs} onChange={(event) => setForm({ ...form, notificationDurationMs: Number(event.target.value) })} />
          </label>
        </div>

        <button type="submit" className="primary-button" disabled={busy}>
          Save settings
        </button>
      </form>
    </SectionCard>
  )
}
