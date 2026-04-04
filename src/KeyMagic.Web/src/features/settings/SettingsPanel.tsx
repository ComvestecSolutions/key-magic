import { useEffect, useState, type FormEvent } from 'react'
import type { SettingsUpdateInput, StatusSnapshot } from '../../app/types'
import { SectionCard } from '../../shared/SectionCard'

interface SettingsFormState extends Omit<SettingsUpdateInput, 'maxLogEntries' | 'notificationDurationMs'> {
  maxLogEntries: string
  notificationDurationMs: string
}

interface SettingsPanelProps {
  status: StatusSnapshot
  busy: boolean
  onSave: (input: SettingsUpdateInput) => Promise<void>
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

export function SettingsPanel({ status, busy, onSave }: SettingsPanelProps) {
  const [form, setForm] = useState<SettingsFormState>(() => toSettingsForm(status))
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setForm(toSettingsForm(status))
    setSaveError(null)
  }, [status])

  function updateForm<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setSaveError(null)
  }

  function parseBoundedInteger(rawValue: string, label: string, min: number, max: number): number | null {
    if (rawValue.trim() === '') {
      setSaveError(`${label} is required.`)
      return null
    }

    const parsed = Number.parseInt(rawValue, 10)
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      setSaveError(`${label} must be between ${min} and ${max}.`)
      return null
    }

    return parsed
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError(null)

    const maxLogEntries = parseBoundedInteger(form.maxLogEntries, 'Max log entries', 10, 10000)
    if (maxLogEntries === null) {
      return
    }

    const notificationDurationMs = parseBoundedInteger(form.notificationDurationMs, 'Notification duration', 500, 30000)
    if (notificationDurationMs === null) {
      return
    }

    try {
      await onSave({
        ...form,
        maxLogEntries,
        notificationDurationMs,
      })
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : 'Failed to save settings.')
    }
  }

  return (
    <SectionCard title="Settings" subtitle="Tune notifications, retention, and startup behavior without leaving the keyboard stack.">
      <form className="editor-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="toggle-grid">
          <label className="inline-toggle"><input type="checkbox" checked={form.showNotifications} onChange={(event) => updateForm('showNotifications', event.target.checked)} />Show notifications</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.trayIconVisible} onChange={(event) => updateForm('trayIconVisible', event.target.checked)} />Tray icon visible</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.logPassThrough} onChange={(event) => updateForm('logPassThrough', event.target.checked)} />Log pass-through events</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.allowSingleKeyBlocking} onChange={(event) => updateForm('allowSingleKeyBlocking', event.target.checked)} />Allow single-key blocking</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.startWithWindows} onChange={(event) => updateForm('startWithWindows', event.target.checked)} />Start with Windows</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.startEnabled} onChange={(event) => updateForm('startEnabled', event.target.checked)} />Start enabled</label>
          <label className="inline-toggle"><input type="checkbox" checked={form.notificationSound} onChange={(event) => updateForm('notificationSound', event.target.checked)} />Notification sound</label>
        </div>

        <div className="form-row form-row--split">
          <label>
            <span>Max log entries</span>
            <input type="number" min={10} max={10000} value={form.maxLogEntries} onChange={(event) => updateForm('maxLogEntries', event.target.value)} />
          </label>
          <label>
            <span>Notification duration (ms)</span>
            <input type="number" min={500} max={30000} value={form.notificationDurationMs} onChange={(event) => updateForm('notificationDurationMs', event.target.value)} />
          </label>
        </div>

        {saveError ? <p className="error-text">{saveError}</p> : null}

        <button type="submit" className="primary-button" disabled={busy}>
          Save settings
        </button>
      </form>
    </SectionCard>
  )
}
