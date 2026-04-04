import { useDeferredValue, useState, type FormEvent } from 'react'
import { buildShortcutDisplay, getVirtualKeyCode } from '../../app/shortcuts'
import type { CreateTypingRuleInput, TypingRule } from '../../app/types'
import { SectionCard } from '../../shared/SectionCard'

interface TypingRulesPanelProps {
  rules: TypingRule[]
  busy: boolean
  onCreate: (input: CreateTypingRuleInput) => Promise<void>
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onFire: (rule: TypingRule, preDelayMs: number) => Promise<void>
}

const initialForm = {
  name: '',
  keyLabel: '',
  ctrl: true,
  alt: false,
  shift: false,
  win: false,
  source: 0 as 0 | 1,
  text: '',
  interKeyDelayMs: 30,
  enabled: true,
}

export function TypingRulesPanel({ rules, busy, onCreate, onToggle, onDelete, onFire }: TypingRulesPanelProps) {
  const [form, setForm] = useState(initialForm)
  const [preDelayMs, setPreDelayMs] = useState(250)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  const filteredRules = [...rules]
    .sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.name.localeCompare(right.name))
    .filter((rule) => {
      const query = deferredSearch.trim().toLowerCase()
      if (!query) {
        return true
      }

      return [rule.name, rule.hotkey.displayName, rule.text]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const virtualKeyCode = getVirtualKeyCode(form.keyLabel)
    if (!virtualKeyCode) {
      setError('Use a supported key label such as V, Enter, F2, or /.')
      return
    }

    if (form.source === 0 && !form.text.trim()) {
      setError('Fixed text rules need text content.')
      return
    }

    await onCreate({
      name: form.name,
      displayName: buildShortcutDisplay(form.keyLabel, form),
      virtualKeyCode,
      ctrl: form.ctrl,
      alt: form.alt,
      shift: form.shift,
      win: form.win,
      source: form.source,
      text: form.text,
      interKeyDelayMs: form.interKeyDelayMs,
      enabled: form.enabled,
    })

    setForm(initialForm)
  }

  return (
    <SectionCard title="Typing Rules" subtitle="Bind reusable text payloads to hotkeys for replies, templates, and clipboard-driven injection.">
      <div className="module-grid">
        <form className="editor-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-row form-row--split">
            <label>
              <span>Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Fast support reply"
              />
            </label>
            <label>
              <span>Key</span>
              <input
                value={form.keyLabel}
                onChange={(event) => setForm({ ...form, keyLabel: event.target.value })}
                placeholder="R"
              />
            </label>
          </div>

          <div className="toggle-row">
            <label><input type="checkbox" checked={form.ctrl} onChange={(event) => setForm({ ...form, ctrl: event.target.checked })} />Ctrl</label>
            <label><input type="checkbox" checked={form.alt} onChange={(event) => setForm({ ...form, alt: event.target.checked })} />Alt</label>
            <label><input type="checkbox" checked={form.shift} onChange={(event) => setForm({ ...form, shift: event.target.checked })} />Shift</label>
            <label><input type="checkbox" checked={form.win} onChange={(event) => setForm({ ...form, win: event.target.checked })} />Win</label>
          </div>

          <div className="form-row form-row--split">
            <label>
              <span>Source</span>
              <select
                value={form.source}
                onChange={(event) => setForm({ ...form, source: Number(event.target.value) as 0 | 1 })}
              >
                <option value={0}>Fixed text</option>
                <option value={1}>Clipboard</option>
              </select>
            </label>
            <label>
              <span>Inter-key delay (ms)</span>
              <input
                type="number"
                min={0}
                max={10000}
                value={form.interKeyDelayMs}
                onChange={(event) => setForm({ ...form, interKeyDelayMs: Number(event.target.value) })}
              />
            </label>
          </div>

          <label>
            <span>Text payload</span>
            <textarea
              rows={4}
              value={form.text}
              onChange={(event) => setForm({ ...form, text: event.target.value })}
              placeholder="Thanks for the update. We are shipping the fix this afternoon."
              disabled={form.source === 1}
            />
          </label>

          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
            />
            Start enabled
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={busy}>
            Add typing rule
          </button>
        </form>

        <div className="list-panel">
          <div className="panel-toolbar panel-toolbar--stacked">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter typing rules" />
            <label>
              <span>Manual fire pre-delay</span>
              <input type="number" min={0} max={60000} value={preDelayMs} onChange={(event) => setPreDelayMs(Number(event.target.value))} />
            </label>
          </div>

          <div className="rule-list">
            {filteredRules.length === 0 ? <p className="muted-text">No typing rules matched the current filter.</p> : null}
            {filteredRules.map((rule) => (
              <article key={rule.id} className="rule-card">
                <div className="rule-card__header">
                  <div>
                    <h3>{rule.name || rule.hotkey.displayName}</h3>
                    <p>{rule.hotkey.displayName}</p>
                  </div>
                  <span className={`rule-badge ${rule.enabled ? 'rule-badge--enabled' : 'rule-badge--disabled'}`}>
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="rule-snippet">{rule.source === 0 ? rule.text || 'No fixed text configured.' : 'Clipboard source at trigger time.'}</p>
                <div className="chip-list">
                  <span className="chip chip--plain">{rule.source === 0 ? 'Fixed text' : 'Clipboard'}</span>
                  <span className="chip chip--plain">{rule.interKeyDelayMs} ms delay</span>
                </div>
                <div className="inline-actions">
                  <button type="button" className="ghost-button" onClick={() => void onToggle(rule.id)} disabled={busy}>
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => void onFire(rule, preDelayMs)} disabled={busy || !rule.enabled}>
                    Fire now
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
