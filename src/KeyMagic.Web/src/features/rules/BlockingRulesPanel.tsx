import { useCallback, useDeferredValue, useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { buildShortcutDisplay, getVirtualKeyCode, parseShortcutDisplay } from '../../app/shortcuts'
import type {
  BatchCreateBlockingRulesInput,
  BatchUpdateBlockingRulesInput,
  BlockingRule,
  CreateBlockingRuleInput,
  ProcessInfo,
  UpdateBlockingRuleInput,
} from '../../app/types'
import { ConfirmDialog } from '../../shared/ConfirmDialog'
import { SectionCard } from '../../shared/SectionCard'
import { type ShortcutBuilderValue } from '../../shared/ShortcutBuilder'
import { BatchCreateDialog } from './BatchCreateDialog'
import { BatchUpdateDialog } from './BatchUpdateDialog'
import { RuleEditorDialog } from './RuleEditorDialog'
import type { BatchComposerState, BatchCreateState, BatchShortcutDraft, RuleEditorFormState, ValidBatchShortcutDraft } from './blockingRuleDialogTypes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, Shield } from 'lucide-react'

interface BlockingRulesPanelProps {
  rules: BlockingRule[]
  processes: ProcessInfo[]
  busy: boolean
  onCreate: (input: CreateBlockingRuleInput) => Promise<void>
  onUpdate: (id: string, input: UpdateBlockingRuleInput) => Promise<void>
  onBatchCreate: (input: BatchCreateBlockingRulesInput) => Promise<void>
  onBatchUpdate: (input: BatchUpdateBlockingRulesInput) => Promise<void>
  onBatchToggle: (ids: string[], enabled: boolean) => Promise<void>
  onBatchDelete: (ids: string[]) => Promise<void>
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const createdAtFormatter = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
})

const initialForm: RuleEditorFormState = {
  keyLabel: '',
  ctrl: true,
  alt: false,
  shift: false,
  win: false,
  description: '',
  targetProcesses: [] as string[],
}

const emptyShortcutBuilder: ShortcutBuilderValue = {
  keyLabel: '',
  ctrl: false,
  alt: false,
  shift: false,
  win: false,
}

const initialBatchComposer: BatchComposerState = {
  ...emptyShortcutBuilder,
  ctrl: true,
  description: '',
}

function getBatchCreateDraftCollections(batchText: string): Pick<BatchCreateState, 'batchDrafts' | 'validBatchDrafts' | 'invalidBatchDrafts'> {
  const batchDrafts = parseBatchShortcutDrafts(batchText)

  return {
    batchDrafts,
    validBatchDrafts: batchDrafts.filter((draft): draft is ValidBatchShortcutDraft => draft.shortcut !== undefined),
    invalidBatchDrafts: batchDrafts.filter((draft) => draft.error !== undefined),
  }
}

function createInitialBatchCreateState(initialComposer: BatchComposerState): BatchCreateState {
  return {
    batchText: '',
    batchComposer: { ...initialComposer },
    batchTargetProcesses: [],
    batchEnabled: true,
    ...getBatchCreateDraftCollections(''),
    batchCreateError: null,
    editingBatchDraftLine: null,
    editingBatchDraftShortcutText: '',
    editingBatchDraftNoteText: '',
  }
}

function normalizeBatchCreateState(nextState: BatchCreateState): BatchCreateState {
  return {
    ...nextState,
    ...getBatchCreateDraftCollections(nextState.batchText),
  }
}

function useBatchCreateState(initialComposer: BatchComposerState) {
  const [batchCreateOpen, setBatchCreateOpen] = useState(false)
  const [batchCreateStateValue, setBatchCreateStateValue] = useState<BatchCreateState>(() => createInitialBatchCreateState(initialComposer))

  const setBatchCreateState = useCallback<Dispatch<SetStateAction<BatchCreateState>>>((nextValue) => {
    setBatchCreateStateValue((current) => {
      const nextState = typeof nextValue === 'function'
        ? nextValue(current)
        : nextValue

      return normalizeBatchCreateState(nextState)
    })
  }, [])

  const resetBatchCreateState = useCallback(() => {
    setBatchCreateStateValue(createInitialBatchCreateState(initialComposer))
  }, [initialComposer])

  return {
    batchCreateOpen, setBatchCreateOpen,
    batchCreateState: batchCreateStateValue,
    setBatchCreateState,
    resetBatchCreateState,
  }
}

function useBatchUpdateState(emptyShortcut: ShortcutBuilderValue) {
  const [batchUpdateOpen, setBatchUpdateOpen] = useState(false)
  const [batchUpdateDescription, setBatchUpdateDescription] = useState('')
  const [batchUpdateProcesses, setBatchUpdateProcesses] = useState<string[]>([])
  const [batchUpdateShortcut, setBatchUpdateShortcut] = useState<ShortcutBuilderValue>({ ...emptyShortcut })
  const [batchUpdateError, setBatchUpdateError] = useState<string | null>(null)
  const [replaceShortcut, setReplaceShortcut] = useState(false)
  const [replaceDescription, setReplaceDescription] = useState(false)
  const [replaceProcesses, setReplaceProcesses] = useState(false)
  return {
    batchUpdateOpen, setBatchUpdateOpen,
    batchUpdateDescription, setBatchUpdateDescription,
    batchUpdateProcesses, setBatchUpdateProcesses,
    batchUpdateShortcut, setBatchUpdateShortcut,
    batchUpdateError, setBatchUpdateError,
    replaceShortcut, setReplaceShortcut,
    replaceDescription, setReplaceDescription,
    replaceProcesses, setReplaceProcesses,
  }
}

function formatRuleCreatedAt(value: string) {
  const createdAt = new Date(value)
  return Number.isNaN(createdAt.getTime()) ? '—' : createdAtFormatter.format(createdAt)
}

function parseBatchShortcutDrafts(batchText: string): BatchShortcutDraft[] {
  const lines = batchText.split(/\r?\n/)
  const rows: BatchShortcutDraft[] = []

  for (const [index, inputLine] of lines.entries()) {
    const rawLine = inputLine.trim()
    if (!rawLine) {
      continue
    }

    const [shortcutPart, ...noteParts] = rawLine.split('|')
    const shortcutText = shortcutPart.trim()
    const noteText = noteParts.join('|').trim()

    if (!shortcutText) {
      rows.push({
        lineNumber: index + 1,
        rawLine,
        shortcutText,
        noteText,
        error: 'Add a shortcut before the note separator.',
      })
      continue
    }

    const parsedShortcut = parseShortcutDisplay(shortcutText)
    if (!parsedShortcut) {
      rows.push({
        lineNumber: index + 1,
        rawLine,
        shortcutText,
        noteText,
        error: 'Shortcut format not recognized. Use values like Ctrl+K or Ctrl+Shift+P.',
      })
      continue
    }

    rows.push({
      lineNumber: index + 1,
      rawLine,
      shortcutText,
      noteText,
      shortcut: {
        displayName: parsedShortcut.displayName,
        virtualKeyCode: parsedShortcut.virtualKeyCode,
        ctrl: parsedShortcut.ctrl,
        alt: parsedShortcut.alt,
        shift: parsedShortcut.shift,
        win: parsedShortcut.win,
        description: noteText || undefined,
      },
    })
  }

  return rows
}

function getScopeSummary(rule: BlockingRule) {
  if (rule.targetProcesses.length === 0) {
    return 'All apps'
  }

  if (rule.targetProcesses.length <= 2) {
    return rule.targetProcesses.join(', ')
  }

  return `${rule.targetProcesses.slice(0, 2).join(', ')} +${rule.targetProcesses.length - 2}`
}

export function BlockingRulesPanel({
  rules,
  processes,
  busy,
  onCreate,
  onUpdate,
  onBatchCreate,
  onBatchUpdate,
  onBatchToggle,
  onBatchDelete,
  onToggle,
  onDelete,
}: BlockingRulesPanelProps) {
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const {
    batchCreateOpen,
    setBatchCreateOpen,
    batchCreateState,
    setBatchCreateState,
    resetBatchCreateState,
  } = useBatchCreateState(initialBatchComposer)
  const {
    batchTargetProcesses,
    batchEnabled,
    batchComposer,
    batchDrafts,
    validBatchDrafts,
    invalidBatchDrafts,
    editingBatchDraftLine,
    editingBatchDraftShortcutText,
    editingBatchDraftNoteText,
  } = batchCreateState
  const {
    batchUpdateOpen,
    setBatchUpdateOpen,
    batchUpdateDescription,
    setBatchUpdateDescription,
    batchUpdateProcesses,
    setBatchUpdateProcesses,
    batchUpdateShortcut,
    setBatchUpdateShortcut,
    batchUpdateError,
    setBatchUpdateError,
    replaceShortcut,
    setReplaceShortcut,
    replaceDescription,
    setReplaceDescription,
    replaceProcesses,
    setReplaceProcesses,
  } = useBatchUpdateState(emptyShortcutBuilder)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingDeleteRule, setPendingDeleteRule] = useState<BlockingRule | null>(null)
  const deferredSearch = useDeferredValue(search)

  const activeRules = rules.filter((rule) => rule.enabled).length
  const scopedRules = rules.filter((rule) => rule.targetProcesses.length > 0).length

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => rules.some((rule) => rule.id === id)))
  }, [rules])

  useEffect(() => {
    if (selectedIds.length === 0) {
      setActionError(null)
    }
  }, [selectedIds.length])

  function resetEditorState() {
    setForm(initialForm)
    setEditingId(null)
    setError(null)
  }

  function startCreating() {
    resetEditorState()
    setEditorOpen(true)
  }

  function startEditing(rule: BlockingRule) {
    const parsedShortcut = parseShortcutDisplay(rule.shortcut.displayName)
    const keyLabel = parsedShortcut?.keyLabel ?? rule.shortcut.displayName.split('+').pop() ?? ''
    setForm({
      keyLabel,
      ctrl: rule.shortcut.ctrl,
      alt: rule.shortcut.alt,
      shift: rule.shortcut.shift,
      win: rule.shortcut.win,
      description: rule.description,
      targetProcesses: [...rule.targetProcesses],
    })
    setEditingId(rule.id)
    setError(null)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    resetEditorState()
  }

  function resetBatchUpdateState() {
    setBatchUpdateError(null)
    setBatchUpdateDescription('')
    setBatchUpdateProcesses([])
    setBatchUpdateShortcut({ ...emptyShortcutBuilder })
    setReplaceShortcut(false)
    setReplaceDescription(false)
    setReplaceProcesses(false)
  }

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

  const selectedVisibleCount = filteredRules.filter((rule) => selectedIds.includes(rule.id)).length
  const allVisibleSelected = filteredRules.length > 0 && selectedVisibleCount === filteredRules.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  function setRuleSelected(ruleId: string, selected: boolean) {
    setSelectedIds((current) => {
      if (selected) {
        return current.includes(ruleId) ? current : [...current, ruleId]
      }

      return current.filter((id) => id !== ruleId)
    })
  }

  function setAllVisibleSelected(selected: boolean) {
    const visibleIds = filteredRules.map((rule) => rule.id)
    setSelectedIds((current) => {
      if (selected) {
        return [...new Set([...current, ...visibleIds])]
      }

      return current.filter((id) => !visibleIds.includes(id))
    })
  }

  function parseBatchShortcuts() {
    if (batchDrafts.length === 0) {
      setBatchCreateState((current) => ({ ...current, batchCreateError: 'Enter at least one shortcut.' }))
      return null
    }

    if (invalidBatchDrafts.length > 0) {
      setBatchCreateState((current) => ({
        ...current,
        batchCreateError: `Resolve ${invalidBatchDrafts.length} invalid line${invalidBatchDrafts.length === 1 ? '' : 's'} before creating rules.`,
      }))
      return null
    }

    return validBatchDrafts.map((draft) => draft.shortcut)
  }

  function appendBatchComposerRow() {
    const virtualKeyCode = getVirtualKeyCode(batchComposer.keyLabel)
    if (!virtualKeyCode) {
      setBatchCreateState((current) => ({
        ...current,
        batchCreateError: 'Capture or choose a supported shortcut before adding it to the batch.',
      }))
      return
    }

    const nextShortcut = buildShortcutDisplay(batchComposer.keyLabel, batchComposer)
    const nextLine = batchComposer.description.trim()
      ? `${nextShortcut} | ${batchComposer.description.trim()}`
      : nextShortcut

    setBatchCreateState((current) => ({
      ...current,
      batchText: current.batchText.trim().length === 0
        ? nextLine
        : `${current.batchText.replace(/\s+$/, '')}\n${nextLine}`,
      batchCreateError: null,
      batchComposer: { ...current.batchComposer, keyLabel: '' },
    }))
  }

  function resetBatchDraftEditor() {
    setBatchCreateState((current) => ({
      ...current,
      editingBatchDraftLine: null,
      editingBatchDraftShortcutText: '',
      editingBatchDraftNoteText: '',
    }))
  }

  function updateBatchDraftLine(lineNumber: number, nextRawLine: string | null) {
    setBatchCreateState((current) => {
      const lines = current.batchText.split(/\r?\n/)
      const targetIndex = lineNumber - 1

      if (targetIndex < 0 || targetIndex >= lines.length) {
        return current
      }

      if (nextRawLine === null) {
        lines.splice(targetIndex, 1)
      } else {
        lines[targetIndex] = nextRawLine
      }

      return {
        ...current,
        batchText: lines.join('\n').replace(/^\n+/, '').replace(/\n+$/, ''),
      }
    })
  }

  function startEditingBatchDraft(draft: BatchShortcutDraft) {
    setBatchCreateState((current) => ({
      ...current,
      editingBatchDraftLine: draft.lineNumber,
      editingBatchDraftShortcutText: draft.shortcutText,
      editingBatchDraftNoteText: draft.noteText,
      batchCreateError: null,
    }))
  }

  function saveBatchDraftEdit() {
    if (editingBatchDraftLine === null) {
      return
    }

    const shortcutText = editingBatchDraftShortcutText.trim()
    if (!shortcutText) {
      setBatchCreateState((current) => ({
        ...current,
        batchCreateError: 'Add a shortcut before saving the edited row.',
      }))
      return
    }

    const nextRawLine = editingBatchDraftNoteText.trim()
      ? `${shortcutText} | ${editingBatchDraftNoteText.trim()}`
      : shortcutText

    updateBatchDraftLine(editingBatchDraftLine, nextRawLine)
    resetBatchDraftEditor()
    setBatchCreateState((current) => ({ ...current, batchCreateError: null }))
  }

  function deleteBatchDraft(lineNumber: number) {
    updateBatchDraftLine(lineNumber, null)
    if (editingBatchDraftLine === lineNumber) {
      resetBatchDraftEditor()
    }
    setBatchCreateState((current) => ({ ...current, batchCreateError: null }))
  }

  async function handleBatchCreateSubmit() {
    setBatchCreateState((current) => ({ ...current, batchCreateError: null }))
    const shortcuts = parseBatchShortcuts()
    if (!shortcuts) {
      return
    }

    try {
      await onBatchCreate({
        shortcuts,
        targetProcesses: batchTargetProcesses,
        enabled: batchEnabled,
      })
      setBatchCreateOpen(false)
      resetBatchCreateState()
    } catch (batchError) {
      setBatchCreateState((current) => ({
        ...current,
        batchCreateError: batchError instanceof Error ? batchError.message : 'Failed to create rules.',
      }))
    }
  }

  async function handleBatchUpdateSubmit() {
    setBatchUpdateError(null)

    if (selectedIds.length === 0) {
      setBatchUpdateError('Select at least one rule first.')
      return
    }

    if (!replaceShortcut && !replaceDescription && !replaceProcesses) {
      setBatchUpdateError('Choose at least one field to update.')
      return
    }

    const shortcutUpdate: Omit<BatchUpdateBlockingRulesInput, 'ids' | 'description' | 'enabled' | 'targetProcesses'> = {}

    if (replaceShortcut) {
      const virtualKeyCode = getVirtualKeyCode(batchUpdateShortcut.keyLabel)
      if (!virtualKeyCode) {
        setBatchUpdateError('Capture or choose a supported shortcut before applying the batch edit.')
        return
      }

      shortcutUpdate.displayName = buildShortcutDisplay(batchUpdateShortcut.keyLabel, batchUpdateShortcut)
      shortcutUpdate.virtualKeyCode = virtualKeyCode
      shortcutUpdate.ctrl = batchUpdateShortcut.ctrl
      shortcutUpdate.alt = batchUpdateShortcut.alt
      shortcutUpdate.shift = batchUpdateShortcut.shift
      shortcutUpdate.win = batchUpdateShortcut.win
    }

    try {
      await onBatchUpdate({
        ids: selectedIds,
        ...shortcutUpdate,
        description: replaceDescription ? batchUpdateDescription : undefined,
        targetProcesses: replaceProcesses ? batchUpdateProcesses : undefined,
      })
      setBatchUpdateOpen(false)
      resetBatchUpdateState()
      setSelectedIds([])
    } catch (batchError) {
      setBatchUpdateError(batchError instanceof Error ? batchError.message : 'Failed to update selected rules.')
    }
  }

  async function handleBatchToggle(enabled: boolean) {
    if (selectedIds.length === 0) {
      return
    }

    setActionError(null)

    try {
      await onBatchToggle(selectedIds, enabled)
      setSelectedIds([])
    } catch (batchError) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} selected blocking rules.`, batchError)
      setActionError(batchError instanceof Error ? batchError.message : `Failed to ${enabled ? 'enable' : 'disable'} selected rules.`)
    }
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) {
      return
    }

    setActionError(null)

    try {
      await onBatchDelete(selectedIds)
      setSelectedIds([])
      setBatchDeleteOpen(false)
    } catch (batchError) {
      console.error('Failed to delete selected blocking rules.', batchError)
      setActionError(batchError instanceof Error ? batchError.message : 'Failed to delete selected rules.')
    }
  }

  async function handleDeleteRule(rule: BlockingRule) {
    setActionError(null)

    try {
      await onDelete(rule.id)
      setPendingDeleteRule(null)
    } catch (deleteError) {
      console.error('Failed to delete blocking rule.', deleteError)
      setPendingDeleteRule(null)
      setActionError(deleteError instanceof Error ? deleteError.message : 'Failed to delete blocking rule.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const virtualKeyCode = getVirtualKeyCode(form.keyLabel)
    if (!virtualKeyCode) {
      setError('Use a supported key label such as K, 1, Enter, Tab, F5, or ;.')
      return
    }

    const shortcutInput = {
      displayName: buildShortcutDisplay(form.keyLabel, form),
      virtualKeyCode,
      ctrl: form.ctrl,
      alt: form.alt,
      shift: form.shift,
      win: form.win,
      targetProcesses: form.targetProcesses,
      description: form.description || undefined,
    }

    try {
      if (editingId) {
        await onUpdate(editingId, shortcutInput)
      } else {
        await onCreate(shortcutInput)
      }

      closeEditor()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : editingId ? 'Failed to update blocking rule.' : 'Failed to create blocking rule.')
    }
  }
  return (
    <SectionCard
      eyebrow="Protection"
      title="Blocking Rules"
      action={
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">{activeRules} live</Badge>
          <Button type="button" size="sm" onClick={startCreating} disabled={busy}>
            <Plus className="size-4" />
            New rule
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setBatchCreateOpen(true)} disabled={busy}>
            Batch add
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="toolbar-band">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search shortcut, note, or app..."
            className="md:max-w-sm"
          />
          <Badge variant="secondary">{filteredRules.length} visible</Badge>
          <Badge variant="outline">{rules.length} total</Badge>
          <Badge variant="info">{scopedRules} scoped</Badge>
          {selectedIds.length > 0 ? <Badge variant="warning">{selectedIds.length} selected</Badge> : null}
        </div>

        <div className="toolbar-band">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAllVisibleSelected(!allVisibleSelected)}
            disabled={filteredRules.length === 0}
          >
            {allVisibleSelected ? 'Clear visible' : 'Select visible'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
            Clear selection
          </Button>
          <div className="flex w-full flex-wrap gap-2 md:ml-auto md:w-auto md:justify-end">
            <Button type="button" size="sm" variant="success" disabled={busy || selectedIds.length === 0} onClick={() => void handleBatchToggle(true)}>
              Enable
            </Button>
            <Button type="button" size="sm" variant="warning" disabled={busy || selectedIds.length === 0} onClick={() => void handleBatchToggle(false)}>
              Disable
            </Button>
            <Button
              type="button"
              size="sm"
              variant="info"
              disabled={busy || selectedIds.length === 0}
              onClick={() => {
                resetBatchUpdateState()
                setBatchUpdateOpen(true)
              }}
            >
              Edit shared
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={busy || selectedIds.length === 0} onClick={() => setBatchDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        </div>

        {actionError ? <p className="error-text m-0">{actionError}</p> : null}

        <div className="glass-panel overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[var(--glass-border)] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Shield className="size-4" style={{ color: 'var(--amber)' }} />
              <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Rule inventory
              </p>
            </div>
            <p className="m-0 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {selectedIds.length === 0 ? 'Create, edit, or batch-manage rules from the list.' : `${selectedIds.length} rule${selectedIds.length === 1 ? '' : 's'} ready for batch actions.`}
            </p>
          </div>

          {filteredRules.length === 0 ? (
            <div className="p-4">
              <div className="empty-spotlight">
                <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {search.trim() ? 'No rules match this filter.' : 'No blocking rules yet.'}
                </p>
                <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                  {search.trim() ? 'Try a different search or clear the current filter.' : 'Create a rule to start blocking shortcuts.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {search.trim() ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setSearch('')}>
                      Clear filter
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" onClick={startCreating} disabled={busy}>
                    <Plus className="size-4" />
                    New rule
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={(checked) => setAllVisibleSelected(Boolean(checked))}
                      aria-label="Select all visible rules"
                    />
                  </TableHead>
                  <TableHead>Shortcut</TableHead>
                  <TableHead className="hidden md:table-cell">Coverage</TableHead>
                  <TableHead className="hidden md:table-cell">Note</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-left md:text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => {
                  const isSelected = selectedIds.includes(rule.id)
                  const scopeSummary = getScopeSummary(rule)

                  return (
                    <TableRow key={rule.id} data-state={isSelected ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => setRuleSelected(rule.id, Boolean(checked))}
                          aria-label={`Select ${rule.shortcut.displayName}`}
                        />
                      </TableCell>
                      <TableCell className="min-w-0 font-medium">
                        <div className="space-y-1">
                          <div style={{ color: 'var(--text)' }}>{rule.shortcut.displayName}</div>
                          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            VK {rule.shortcut.virtualKeyCode}
                          </div>
                          <div className="space-y-1 md:hidden">
                            <Badge variant={rule.targetProcesses.length === 0 ? 'warning' : 'info'}>
                              {rule.targetProcesses.length === 0 ? 'Global' : `${rule.targetProcesses.length} app${rule.targetProcesses.length === 1 ? '' : 's'}`}
                            </Badge>
                            <div className="text-xs leading-5" style={{ color: 'var(--text-tertiary)' }}>
                              {scopeSummary}
                            </div>
                            <div className="text-xs leading-5" style={{ color: rule.description ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                              {rule.description || 'No note'}
                            </div>
                            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                              {formatRuleCreatedAt(rule.createdAt)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-1">
                          <Badge variant={rule.targetProcesses.length === 0 ? 'warning' : 'info'}>
                            {rule.targetProcesses.length === 0 ? 'Global' : `${rule.targetProcesses.length} app${rule.targetProcesses.length === 1 ? '' : 's'}`}
                          </Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0} className="interactive-truncate max-w-[220px] text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                {scopeSummary}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{scopeSummary}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[260px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} className="interactive-truncate" style={{ color: rule.description ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                              {rule.description || 'No note'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{rule.description || 'No note provided.'}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{formatRuleCreatedAt(rule.createdAt)}</TableCell>
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
                          <Button type="button" variant="destructive" size="sm" onClick={() => setPendingDeleteRule(rule)} disabled={busy}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <RuleEditorDialog
        editorOpen={editorOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor()
            return
          }

          setEditorOpen(true)
        }}
        form={form}
        setForm={setForm}
        editingId={editingId}
        closeEditor={closeEditor}
        handleSubmit={handleSubmit}
        error={error}
        busy={busy}
        processes={processes}
      />

      <BatchCreateDialog
        batchCreateOpen={batchCreateOpen}
        onOpenChange={setBatchCreateOpen}
        batchCreateState={batchCreateState}
        setBatchCreateState={setBatchCreateState}
        appendBatchComposerRow={appendBatchComposerRow}
        handleBatchCreateSubmit={handleBatchCreateSubmit}
        resetBatchCreateState={resetBatchCreateState}
        busy={busy}
        processes={processes}
        saveBatchDraftEdit={saveBatchDraftEdit}
        resetBatchDraftEditor={resetBatchDraftEditor}
        deleteBatchDraft={deleteBatchDraft}
        startEditingBatchDraft={startEditingBatchDraft}
      />

      <BatchUpdateDialog
        batchUpdateOpen={batchUpdateOpen}
        onOpenChange={setBatchUpdateOpen}
        selectedIds={selectedIds}
        batchUpdateShortcut={batchUpdateShortcut}
        setBatchUpdateShortcut={setBatchUpdateShortcut}
        replaceShortcut={replaceShortcut}
        setReplaceShortcut={setReplaceShortcut}
        replaceDescription={replaceDescription}
        setReplaceDescription={setReplaceDescription}
        replaceProcesses={replaceProcesses}
        setReplaceProcesses={setReplaceProcesses}
        batchUpdateDescription={batchUpdateDescription}
        setBatchUpdateDescription={setBatchUpdateDescription}
        batchUpdateProcesses={batchUpdateProcesses}
        setBatchUpdateProcesses={setBatchUpdateProcesses}
        handleBatchUpdateSubmit={handleBatchUpdateSubmit}
        resetBatchUpdateState={resetBatchUpdateState}
        batchUpdateError={batchUpdateError}
        setBatchUpdateError={setBatchUpdateError}
        busy={busy}
        processes={processes}
      />

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title="Delete selected rules?"
        description={`This will permanently remove ${selectedIds.length} selected rule${selectedIds.length === 1 ? '' : 's'}.`}
        confirmLabel="Delete selected rules"
        confirmVariant="destructive"
        busy={busy}
        onConfirm={handleBatchDelete}
      />

      <ConfirmDialog
        open={pendingDeleteRule !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteRule(null)
          }
        }}
        title="Delete blocking rule?"
        description={`This will permanently remove ${pendingDeleteRule?.shortcut.displayName ?? 'the selected rule'}.`}
        confirmLabel="Delete rule"
        confirmVariant="destructive"
        busy={busy}
        onConfirm={() => pendingDeleteRule ? handleDeleteRule(pendingDeleteRule) : Promise.resolve()}
      />
    </SectionCard>
  )
}