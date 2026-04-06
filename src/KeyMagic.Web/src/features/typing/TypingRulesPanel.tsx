import { useCallback, useDeferredValue, useState, type FormEvent } from 'react'
import { buildShortcutDisplay, getVirtualKeyCode, parseShortcutDisplay } from '../../app/shortcuts'
import { TextSource, type CreateTypingRuleInput, type TypingRule, type UpdateTypingRuleInput } from '../../app/types'
import { ConfirmDialog } from '../../shared/ConfirmDialog'
import { FormField } from '../../shared/FormField'
import { SectionCard } from '../../shared/SectionCard'
import { ShortcutBuilder } from '../../shared/ShortcutBuilder'
import { Switch } from '../../components/ui/switch'
import { Play, Plus, Type } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSheetContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface TypingRulesPanelProps {
  rules: TypingRule[]
  busy: boolean
  onCreate: (input: CreateTypingRuleInput) => Promise<void>
  onUpdate: (id: string, input: UpdateTypingRuleInput) => Promise<void>
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
  source: TextSource.FixedText,
  text: '',
  interKeyDelayMs: 30,
  enabled: true,
}

export function TypingRulesPanel({ rules, busy, onCreate, onUpdate, onToggle, onDelete, onFire }: TypingRulesPanelProps) {
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [preDelayMs, setPreDelayMs] = useState(250)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'enabled' | 'clipboard'>('all')
  const [pendingDeleteRule, setPendingDeleteRule] = useState<TypingRule | null>(null)
  const deferredSearch = useDeferredValue(search)

  const enabledRules = rules.filter((rule) => rule.enabled).length
  const clipboardRules = rules.filter((rule) => rule.source === TextSource.Clipboard).length
  const averageDelay = rules.length === 0 ? 0 : Math.round(rules.reduce((total, rule) => total + rule.interKeyDelayMs, 0) / rules.length)

  function resetEditorState() {
    setForm(initialForm)
    setEditingId(null)
    setError(null)
  }

  function startCreating() {
    resetEditorState()
    setEditorOpen(true)
  }

  function startEditing(rule: TypingRule) {
    const parsedShortcut = parseShortcutDisplay(rule.hotkey.displayName)
    const keyLabel = parsedShortcut?.keyLabel ?? rule.hotkey.displayName.split('+').pop() ?? ''
    setForm({
      name: rule.name,
      keyLabel,
      ctrl: rule.hotkey.ctrl,
      alt: rule.hotkey.alt,
      shift: rule.hotkey.shift,
      win: rule.hotkey.win,
      source: rule.source,
      text: rule.text,
      interKeyDelayMs: rule.interKeyDelayMs,
      enabled: rule.enabled,
    })
    setEditingId(rule.id)
    setError(null)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    resetEditorState()
  }

  const filteredRules = [...rules]
    .sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.name.localeCompare(right.name))
    .filter((rule) => {
      if (filterMode === 'enabled' && !rule.enabled) {
        return false
      }

      if (filterMode === 'clipboard' && rule.source !== 1) {
        return false
      }

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

    if (form.source === TextSource.FixedText && !form.text.trim()) {
      setError('Fixed text rules need text content.')
      return
    }

    const ruleInput = {
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
    }

    try {
      if (editingId) {
        await onUpdate(editingId, ruleInput)
      } else {
        await onCreate(ruleInput)
      }

      closeEditor()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : editingId ? 'Failed to update typing rule.' : 'Failed to create typing rule.')
    }
  }

  async function handleDeleteRule(rule: TypingRule) {
    await onDelete(rule.id)
    setPendingDeleteRule(null)
  }

  const shortcutPreview = form.keyLabel ? buildShortcutDisplay(form.keyLabel, form) : 'No trigger selected'
  const sourcePreviewLabel = form.source === TextSource.FixedText ? 'Fixed text payload' : 'Clipboard payload'
  const payloadPreviewCopy = form.source === TextSource.FixedText
    ? form.text.trim()
      ? `${form.text.length} characters will be typed with the configured inter-key delay.`
      : 'Add text content to create the payload.'
    : 'Clipboard contents are captured when the trigger fires and typed using the same timing.'
  const executionStateCopy = form.enabled
    ? 'The macro will be ready to fire as soon as it is saved.'
    : 'The macro will be saved disabled until you turn it on.'
  const handleShortcutChange = useCallback((nextValue: Parameters<typeof ShortcutBuilder>[0]['value']) => {
    setForm((current) => ({ ...current, ...nextValue }))
  }, [])

  return (
    <SectionCard
      eyebrow="Automation"
      title="Typing Rules"
      action={
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">{enabledRules} active</Badge>
          <Button type="button" size="sm" onClick={startCreating} disabled={busy}>
            <Plus className="size-4" />
            New macro
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="toolbar-band">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, trigger, or payload..."
            className="md:max-w-sm"
          />
          <Badge variant="secondary">{filteredRules.length} visible</Badge>
          <Badge variant="outline">{rules.length} total</Badge>
          <Badge variant="info">{clipboardRules} clipboard</Badge>
          <Badge variant="outline">{averageDelay}ms avg</Badge>
        </div>

        <div className="toolbar-band">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={filterMode === 'all' ? 'border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] text-[var(--text)]' : undefined}
            onClick={() => setFilterMode('all')}
          >
            All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={filterMode === 'enabled' ? 'border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.08)] text-[var(--emerald)]' : undefined}
            onClick={() => setFilterMode('enabled')}
          >
            Enabled
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={filterMode === 'clipboard' ? 'border-[rgba(6,182,212,0.2)] bg-[rgba(6,182,212,0.08)] text-[var(--cyan)]' : undefined}
            onClick={() => setFilterMode('clipboard')}
          >
            Clipboard
          </Button>
          <div className="flex w-full items-center justify-between gap-2 text-xs sm:ml-auto sm:w-auto sm:justify-start" style={{ color: 'var(--text-tertiary)' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>Pre-delay</span>
            <Input type="number" min={0} max={60000} value={preDelayMs} onChange={(event) => setPreDelayMs(Number(event.target.value))} className="w-28" />
          </div>
        </div>

        <div className="glass-panel overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[var(--glass-border)] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Type className="size-4" style={{ color: 'var(--amber)' }} />
              <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Macro inventory
              </p>
            </div>
            <p className="m-0 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Test runs wait {preDelayMs}ms before typing.
            </p>
          </div>

          {filteredRules.length === 0 ? (
            <div className="p-4">
              <div className="empty-spotlight">
                <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {search.trim() ? 'No macros match this filter.' : 'No typing macros yet.'}
                </p>
                <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                  {search.trim() ? 'Try a different search or clear the current filter.' : 'Create a macro to start automating repeatable text.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {search.trim() ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setSearch('')}>
                      Clear filter
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" onClick={startCreating} disabled={busy}>
                    <Plus className="size-4" />
                    New macro
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Trigger</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="hidden md:table-cell">Payload</TableHead>
                  <TableHead className="hidden md:table-cell">Delay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-left md:text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="min-w-0 font-medium">
                      <div className="space-y-1">
                        <div style={{ color: 'var(--text)' }}>{rule.name || rule.hotkey.displayName}</div>
                        <div className="space-y-1 md:hidden">
                          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{rule.hotkey.displayName}</div>
                          <div className="text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                            {rule.source === TextSource.FixedText ? (rule.text || 'No fixed text configured.') : 'Clipboard at trigger time'}
                          </div>
                          <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{rule.interKeyDelayMs}ms inter-key delay</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{rule.hotkey.displayName}</TableCell>
                    <TableCell>
                      <Badge variant={rule.source === TextSource.FixedText ? 'warning' : 'info'}>
                        {rule.source === TextSource.FixedText ? 'Fixed text' : 'Clipboard'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[260px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="interactive-truncate">
                            {rule.source === TextSource.FixedText ? (rule.text || 'No fixed text configured.') : 'Clipboard at trigger time'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {rule.source === TextSource.FixedText ? (rule.text || 'No fixed text configured.') : 'Clipboard at trigger time'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{rule.interKeyDelayMs}ms</TableCell>
                    <TableCell>
                      <Badge variant={rule.enabled ? 'success' : 'outline'}>{rule.enabled ? 'Enabled' : 'Disabled'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="table-action-row">
                        <Button type="button" variant="info" size="sm" onClick={() => startEditing(rule)} disabled={busy}>
                          Edit
                        </Button>
                        <Button type="button" variant={rule.enabled ? 'warning' : 'success'} size="sm" onClick={() => void onToggle(rule.id)} disabled={busy}>
                          {rule.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button type="button" variant="info" size="sm" onClick={() => void onFire(rule, preDelayMs)} disabled={busy || !rule.enabled}>
                          <Play className="h-3.5 w-3.5" />
                          Fire
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => setPendingDeleteRule(rule)} disabled={busy}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor()
            return
          }

          setEditorOpen(true)
        }}
      >
        <DialogSheetContent className="md:max-w-[66rem]">
          <form className="editor-sheet" onSubmit={(event) => void handleSubmit(event)}>
            <DialogHeader className="pr-10">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{editingId ? 'Edit macro' : 'New macro'}</DialogTitle>
                <Badge variant={editingId ? 'secondary' : 'outline'}>{editingId ? 'Editing' : 'Create'}</Badge>
              </div>
              <DialogDescription>
                {editingId ? 'Update trigger, payload, or timing.' : 'Create a typing macro.'}
              </DialogDescription>
            </DialogHeader>

            <div className="editor-sheet__body editor-sheet__body--balanced">
              <div className="editor-sheet__main">
                <section className="editor-sheet__section space-y-4">
                  <div className="editor-sheet__section-header">
                    <div className="editor-sheet__section-copy">
                      <p className="ui-eyebrow m-0">Macro setup</p>
                      <p className="ui-copy-xs">
                        Give the macro a label if you want one, then capture the hotkey that should fire it.
                      </p>
                    </div>
                    <Badge variant={editingId ? 'secondary' : 'outline'}>{editingId ? 'Editing live macro' : 'New typing macro'}</Badge>
                  </div>

                  <FormField label="Name" hint="Optional" description="Use a short label so the macro is easy to scan in the list.">
                    <Input
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      placeholder="Fast support reply"
                      disabled={busy}
                    />
                  </FormField>

                  <FormField label="Trigger" required>
                    <ShortcutBuilder
                      value={form}
                      onChange={handleShortcutChange}
                      disabled={busy}
                    />
                  </FormField>
                </section>
              </div>

              <div className="editor-sheet__side">
                <section className="editor-sheet__aside space-y-4">
                  <div className="editor-sheet__section-header">
                    <div className="editor-sheet__section-copy">
                      <p className="ui-eyebrow m-0">Payload and execution</p>
                      <p className="ui-copy-xs">
                        Use the side rail for the text source, payload content, and the timing controls that shape delivery.
                      </p>
                    </div>
                    <Badge variant={form.source === TextSource.FixedText ? 'warning' : 'info'}>
                      {form.source === TextSource.FixedText ? 'Fixed text' : 'Clipboard'}
                    </Badge>
                  </div>

                  <FormField label="Source">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className={form.source === TextSource.FixedText ? 'border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.08)] text-[var(--amber)]' : undefined}
                        onClick={() => setForm({ ...form, source: TextSource.FixedText })}
                        disabled={busy}
                      >
                        Fixed text
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={form.source === TextSource.Clipboard ? 'border-[rgba(6,182,212,0.18)] bg-[rgba(6,182,212,0.08)] text-[var(--cyan)]' : undefined}
                        onClick={() => setForm({ ...form, source: TextSource.Clipboard })}
                        disabled={busy}
                      >
                        Clipboard
                      </Button>
                    </div>
                  </FormField>

                  <FormField
                    label="Payload"
                    description={form.source === TextSource.FixedText ? 'KeyMagic types this text when the trigger fires.' : 'Clipboard mode ignores manual text and uses the current clipboard contents instead.'}
                    hint={form.source === TextSource.FixedText ? `${form.text.length} characters.` : 'Ignored in clipboard mode.'}
                  >
                    <Textarea
                      rows={7}
                      value={form.text}
                      onChange={(event) => setForm({ ...form, text: event.target.value })}
                      placeholder="Thanks for the update. We are shipping the fix this afternoon."
                      disabled={busy || form.source === TextSource.Clipboard}
                    />
                  </FormField>

                  <FormField label="Inter-key delay" description="Milliseconds between each emitted key press.">
                    <Input
                      type="number"
                      min={0}
                      max={10000}
                      value={form.interKeyDelayMs}
                      onChange={(event) => setForm({ ...form, interKeyDelayMs: Number(event.target.value) })}
                      disabled={busy}
                    />
                  </FormField>

                  <div className="editor-sheet__toggle">
                    <div>
                      <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>Enabled</p>
                      <p className="m-0 mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                        {executionStateCopy}
                      </p>
                    </div>
                    <Switch checked={form.enabled} onCheckedChange={(checked) => setForm({ ...form, enabled: checked })} size="sm" />
                  </div>
                </section>

                <section className="editor-sheet__aside space-y-4">
                  <div className="editor-sheet__preview">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <p className="ui-eyebrow ui-eyebrow--tight">Preview</p>
                        <p className="m-0 text-base font-semibold tracking-[-0.02em]" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                          {shortcutPreview}
                        </p>
                        <p className="ui-copy-xs">{sourcePreviewLabel}</p>
                      </div>
                      <Badge variant={form.source === TextSource.FixedText ? 'warning' : 'info'}>
                        {form.source === TextSource.FixedText ? 'Fixed text' : 'Clipboard'}
                      </Badge>
                    </div>
                  </div>

                  <div className="editor-sheet__preview">
                    <p className="ui-eyebrow ui-eyebrow--tight">Payload readiness</p>
                    <div className="space-y-1.5">
                      <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {form.source === TextSource.FixedText ? 'Text payload' : 'Clipboard payload'}
                      </p>
                      <p className="ui-copy-xs">{payloadPreviewCopy}</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {error ? <p className="error-text m-0">{error}</p> : null}

            <DialogFooter className="mt-auto">
              <Button type="button" variant="outline" onClick={closeEditor} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {editingId ? 'Save macro' : 'Add macro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogSheetContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDeleteRule !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteRule(null)
          }
        }}
        title="Delete typing macro?"
        description={`This will permanently remove ${pendingDeleteRule ? pendingDeleteRule.name || pendingDeleteRule.hotkey.displayName : 'the selected macro'}.`}
        confirmLabel="Delete macro"
        confirmVariant="destructive"
        busy={busy}
        onConfirm={async () => {
          if (pendingDeleteRule) {
            await handleDeleteRule(pendingDeleteRule)
          }
        }}
      />
    </SectionCard>
  )
}