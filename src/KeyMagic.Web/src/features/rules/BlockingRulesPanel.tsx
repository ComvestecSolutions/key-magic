import { useDeferredValue, useState, type FormEvent } from 'react'
import { buildShortcutDisplay, getVirtualKeyCode } from '../../app/shortcuts'
import type { BlockingRule, CreateBlockingRuleInput, ProcessInfo } from '../../app/types'
import { ProcessSelector } from '../../shared/ProcessSelector'
import { SectionCard } from '../../shared/SectionCard'

interface BlockingRulesPanelProps {
  rules: BlockingRule[]
  processes: ProcessInfo[]
  busy: boolean
  onCreate: (input: CreateBlockingRuleInput) => Promise<void>
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const initialForm = {
  keyLabel: '',
  ctrl: true,
  alt: false,
  shift: false,
  win: false,
  description: '',
  targetProcesses: [] as string[],
}

export function BlockingRulesPanel({ rules, processes, busy, onCreate, onToggle, onDelete }: BlockingRulesPanelProps) {
  const [form, setForm] = useState(initialForm)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  const filteredRules = [...rules]
    .sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.shortcut.displayName.localeCompare(right.shortcut.displayName))
    .filter((rule) => {
      const query = deferredSearch.trim().toLowerCase()
      if (!query) {
        return true
      }

      return [rule.shortcut.displayName, rule.description, ...rule.targetProcesses]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const virtualKeyCode = getVirtualKeyCode(form.keyLabel)
    if (!virtualKeyCode) {
      setError('Use a supported key label such as K, 1, Enter, Tab, F5, or ;.')
      return
    }

    await onCreate({
      displayName: buildShortcutDisplay(form.keyLabel, form),
      virtualKeyCode,
      ctrl: form.ctrl,
      alt: form.alt,
      shift: form.shift,
      win: form.win,
      targetProcesses: form.targetProcesses,
      description: form.description || undefined,
    })

    setForm(initialForm)
  }

  return (
    <SectionCard title="Blocking Rules" subtitle="Target shortcuts globally or pin them to the apps that keep hijacking your workflow.">
      <div className="module-grid">
        <form className="editor-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-row form-row--split">
            <label>
              <span>Key</span>
              <input
                value={form.keyLabel}
                onChange={(event) => setForm({ ...form, keyLabel: event.target.value })}
                placeholder="K or Enter"
              />
            </label>
            <label>
              <span>Description</span>
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Block AI overlay shortcut"
              />
            </label>
          </div>

          <div className="toggle-row">
            <label><input type="checkbox" checked={form.ctrl} onChange={(event) => setForm({ ...form, ctrl: event.target.checked })} />Ctrl</label>
            <label><input type="checkbox" checked={form.alt} onChange={(event) => setForm({ ...form, alt: event.target.checked })} />Alt</label>
            <label><input type="checkbox" checked={form.shift} onChange={(event) => setForm({ ...form, shift: event.target.checked })} />Shift</label>
            <label><input type="checkbox" checked={form.win} onChange={(event) => setForm({ ...form, win: event.target.checked })} />Win</label>
          </div>

          <ProcessSelector
            availableProcesses={processes}
            selected={form.targetProcesses}
            onChange={(targetProcesses) => setForm({ ...form, targetProcesses })}
          />

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={busy}>
            Add blocking rule
          </button>
        </form>

        <div className="list-panel">
          <div className="panel-toolbar">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter rules"
            />
            <span className="pill-counter">{filteredRules.length}</span>
          </div>

          <div className="rule-list">
            {filteredRules.length === 0 ? <p className="muted-text">No blocking rules matched the current filter.</p> : null}
            {filteredRules.map((rule) => (
              <article key={rule.id} className="rule-card">
                <div className="rule-card__header">
                  <div>
                    <h3>{rule.shortcut.displayName}</h3>
                    <p>{rule.description || 'No description'}</p>
                  </div>
                  <span className={`rule-badge ${rule.enabled ? 'rule-badge--enabled' : 'rule-badge--disabled'}`}>
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="chip-list">
                  {rule.targetProcesses.length === 0 ? <span className="chip chip--plain">Global</span> : null}
                  {rule.targetProcesses.map((processName) => (
                    <span key={processName} className="chip chip--plain">{processName}</span>
                  ))}
                </div>
                <div className="inline-actions">
                  <button type="button" className="ghost-button" onClick={() => void onToggle(rule.id)} disabled={busy}>
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button type="button" className="danger-button" onClick={() => void onDelete(rule.id)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
