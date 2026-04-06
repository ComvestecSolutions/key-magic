import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { buildShortcutDisplay, getVirtualKeyCode } from '../../app/shortcuts'
import type { ProcessInfo } from '../../app/types'
import { FormField } from '../../shared/FormField'
import { ProcessSelector } from '../../shared/ProcessSelector'
import { ShortcutBuilder, type ShortcutBuilderValue } from '../../shared/ShortcutBuilder'
import { Switch } from '../../components/ui/switch'
import type { BatchCreateState, BatchShortcutDraft } from './blockingRuleDialogTypes'
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

interface BatchCreateDialogProps {
  batchCreateOpen: boolean
  onOpenChange: (open: boolean) => void
  batchCreateState: BatchCreateState
  setBatchCreateState: Dispatch<SetStateAction<BatchCreateState>>
  appendBatchComposerRow: () => void
  handleBatchCreateSubmit: () => Promise<void>
  resetBatchCreateState: () => void
  busy: boolean
  processes: ProcessInfo[]
  saveBatchDraftEdit: () => void
  resetBatchDraftEditor: () => void
  deleteBatchDraft: (lineNumber: number) => void
  startEditingBatchDraft: (draft: BatchShortcutDraft) => void
}

export function BatchCreateDialog({
  batchCreateOpen,
  onOpenChange,
  batchCreateState,
  setBatchCreateState,
  appendBatchComposerRow,
  handleBatchCreateSubmit,
  resetBatchCreateState,
  busy,
  processes,
  saveBatchDraftEdit,
  resetBatchDraftEditor,
  deleteBatchDraft,
  startEditingBatchDraft,
}: BatchCreateDialogProps) {
  const {
    batchText,
    batchComposer,
    batchTargetProcesses,
    batchEnabled,
    batchDrafts,
    validBatchDrafts,
    invalidBatchDrafts,
    batchCreateError,
    editingBatchDraftLine,
    editingBatchDraftShortcutText,
    editingBatchDraftNoteText,
  } = batchCreateState
  const batchLineCount = batchDrafts.length
  const batchReadyCount = validBatchDrafts.length
  const batchScopeLabel = batchTargetProcesses.length === 0 ? 'All apps' : `${batchTargetProcesses.length} app${batchTargetProcesses.length === 1 ? '' : 's'}`
  const batchComposerPreview = batchComposer.keyLabel
    ? buildShortcutDisplay(batchComposer.keyLabel, batchComposer)
    : 'Capture a shortcut to stage the next row.'
  const batchComposerReady = getVirtualKeyCode(batchComposer.keyLabel) !== null
  const batchScopeSummaryCopy = batchTargetProcesses.length === 0
    ? 'Every valid row will inherit a global scope.'
    : `Every valid row will target the same ${batchTargetProcesses.length} selected app${batchTargetProcesses.length === 1 ? '' : 's'}.`
  const batchCreateSummary = invalidBatchDrafts.length > 0
    ? `Resolve ${invalidBatchDrafts.length} line${invalidBatchDrafts.length === 1 ? '' : 's'} before creating the batch.`
    : batchReadyCount > 0
      ? `${batchReadyCount} rule${batchReadyCount === 1 ? '' : 's'} are ready to create.`
      : 'Add shortcuts to build the batch summary.'
  const batchEnabledCopy = batchEnabled
    ? 'Valid rules will turn on immediately after creation.'
    : 'Valid rules will stay disabled until you review them.'

  const handleShortcutChange = useCallback((nextValue: ShortcutBuilderValue) => {
    setBatchCreateState((current) => ({
      ...current,
      batchCreateError: null,
      batchComposer: { ...current.batchComposer, ...nextValue },
    }))
  }, [setBatchCreateState])

  function handleOpenChange(open: boolean) {
    onOpenChange(open)
    if (!open) {
      resetBatchCreateState()
    }
  }

  return (
    <Dialog open={batchCreateOpen} onOpenChange={handleOpenChange}>
      <DialogSheetContent className="md:max-w-[66rem]">
        <div className="editor-sheet">
          <DialogHeader className="pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>Batch add rules</DialogTitle>
              <Badge variant={invalidBatchDrafts.length > 0 ? 'warning' : batchReadyCount > 0 ? 'success' : 'outline'}>
                {invalidBatchDrafts.length > 0 ? 'Needs review' : batchReadyCount > 0 ? 'Ready to create' : 'Waiting for input'}
              </Badge>
            </div>
            <DialogDescription>Paste a batch or build rows with the quick composer, then review the live preview before creating rules.</DialogDescription>
          </DialogHeader>
          <div className="editor-sheet__body editor-sheet__body--balanced">
            <div className="editor-sheet__main">
              <section className="editor-sheet__section space-y-4">
                <div className="editor-sheet__section-header">
                  <div className="editor-sheet__section-copy">
                    <p className="ui-eyebrow m-0">Compose rows</p>
                    <p className="ui-copy-xs">
                      Capture or click a shortcut, add an optional note, then queue that row into the batch list.
                    </p>
                  </div>
                  <Badge variant={batchComposerReady ? 'success' : 'info'}>{batchComposerReady ? 'Shortcut ready' : 'Capture enabled'}</Badge>
                </div>

                <ShortcutBuilder
                  value={batchComposer}
                  onChange={handleShortcutChange}
                  disabled={busy}
                />
              </section>

              <section className="editor-sheet__section space-y-4">
                <div className="editor-sheet__section-copy">
                  <p className="ui-eyebrow m-0">Batch list</p>
                  <p className="ui-copy-xs">
                    Use one shortcut per line. Add <span className="ui-mono">|</span> and a note only when a row needs extra context.
                  </p>
                </div>

                <FormField
                  label="Shortcut list"
                  hint={batchLineCount > 0 ? `${batchReadyCount} of ${batchLineCount} line${batchLineCount === 1 ? '' : 's'} are valid.` : 'Use | note to append an optional note to each row.'}
                >
                  <Textarea
                    value={batchText}
                    onChange={(event) => {
                      const nextBatchText = event.target.value
                      setBatchCreateState((current) => ({
                        ...current,
                        batchCreateError: null,
                        batchText: nextBatchText,
                      }))
                    }}
                    placeholder={'Ctrl+K | Block overlay\nCtrl+Shift+P | Prevent command palette'}
                    className="min-h-[240px] md:min-h-[260px] font-mono"
                  />
                </FormField>
              </section>
            </div>

            <div className="editor-sheet__side">
              <div className="insight-strip">
                <article className="metric-tile">
                  <span className="metric-tile__eyebrow">Input lines</span>
                  <strong className="metric-tile__value">{batchLineCount}</strong>
                </article>
                <article className="metric-tile">
                  <span className="metric-tile__eyebrow">Ready</span>
                  <strong className="metric-tile__value" style={{ color: batchReadyCount > 0 ? 'var(--emerald)' : 'var(--text-secondary)' }}>{batchReadyCount}</strong>
                </article>
                <article className="metric-tile">
                  <span className="metric-tile__eyebrow">Needs review</span>
                  <strong className="metric-tile__value" style={{ color: invalidBatchDrafts.length > 0 ? 'var(--amber)' : 'var(--text-secondary)' }}>{invalidBatchDrafts.length}</strong>
                </article>
              </div>

              <section className="editor-sheet__aside space-y-4">
                <div className="editor-sheet__section-header">
                  <div className="editor-sheet__section-copy">
                    <p className="ui-eyebrow m-0">Shared defaults</p>
                    <p className="ui-copy-xs">
                      Every valid row will inherit the same scope and starting state when the batch is created.
                    </p>
                  </div>
                  <Badge variant={batchTargetProcesses.length === 0 ? 'warning' : 'info'}>{batchScopeLabel}</Badge>
                </div>

                <FormField label="Shared scope" description="Leave the list empty to create global rules for every valid row.">
                  <ProcessSelector
                    availableProcesses={processes}
                    selected={batchTargetProcesses}
                    onChange={(nextBatchTargetProcesses) => {
                      setBatchCreateState((current) => ({
                        ...current,
                        batchTargetProcesses: nextBatchTargetProcesses,
                      }))
                    }}
                  />
                </FormField>

                <div className="editor-sheet__toggle">
                  <div>
                    <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>Start enabled</p>
                    <p className="m-0 mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                      {batchEnabledCopy}
                    </p>
                  </div>
                  <Switch
                    checked={batchEnabled}
                    onCheckedChange={(nextBatchEnabled) => {
                      setBatchCreateState((current) => ({
                        ...current,
                        batchEnabled: nextBatchEnabled,
                      }))
                    }}
                    size="sm"
                  />
                </div>

                <div className="shell-divider" />

                <FormField label="Note" hint="Optional" description="This note is appended only to the next row added from the composer.">
                  <Input
                    value={batchComposer.description}
                    onChange={(event) => {
                      const nextDescription = event.target.value
                      setBatchCreateState((current) => ({
                        ...current,
                        batchComposer: { ...current.batchComposer, description: nextDescription },
                      }))
                    }}
                    placeholder="Optional note appended to the next inserted line"
                    disabled={busy}
                  />
                </FormField>

                <div className="editor-sheet__preview">
                  <p className="ui-eyebrow ui-eyebrow--tight">Next row</p>
                  <div className="space-y-1.5">
                    <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>{batchComposerPreview}</p>
                    <p className="ui-copy-xs" style={{ color: batchComposer.description.trim() ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                      {batchComposer.description.trim() || 'No note will be added to this row.'}
                    </p>
                  </div>
                  <Button type="button" className="w-full" onClick={appendBatchComposerRow} disabled={busy || !batchComposerReady}>
                    Add row to batch
                  </Button>
                </div>
              </section>

              <section className="editor-sheet__aside space-y-3">
                <div className="editor-sheet__section-header">
                  <div className="editor-sheet__section-copy">
                    <p className="ui-eyebrow m-0">Creation summary</p>
                    <p className="ui-copy-xs">{batchCreateSummary}</p>
                  </div>
                  <Badge variant={batchEnabled ? 'success' : 'outline'}>{batchEnabled ? 'Enabled' : 'Disabled'}</Badge>
                </div>

                <div className="glass-surface space-y-3 p-3.5">
                  <div className="ui-stat-row gap-4">
                    <span className="ui-stat-label">Coverage</span>
                    <span className="ui-stat-value--mono" style={{ color: batchTargetProcesses.length === 0 ? 'var(--amber)' : 'var(--cyan)' }}>
                      {batchScopeLabel}
                    </span>
                  </div>
                  <p className="ui-copy-xs">{batchScopeSummaryCopy}</p>

                  <div className="shell-divider" />

                  <div className="ui-stat-row gap-4">
                    <span className="ui-stat-label">Activation</span>
                    <span className="ui-stat-value--mono" style={{ color: batchEnabled ? 'var(--emerald)' : 'var(--text-secondary)' }}>
                      {batchEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="ui-copy-xs">{batchEnabledCopy}</p>
                </div>
              </section>

              <section className="editor-sheet__aside space-y-4">
                <div className="editor-sheet__section-copy">
                  <p className="ui-eyebrow m-0">Review queue</p>
                  <p className="ui-copy-xs">
                    Review, edit, or delete queued rows before they inherit the shared defaults from this side panel.
                  </p>
                </div>

                <div className="editor-sheet__meta">
                  <Badge variant={batchReadyCount > 0 ? 'success' : 'outline'}>{batchReadyCount} ready</Badge>
                  <Badge variant={invalidBatchDrafts.length > 0 ? 'warning' : 'outline'}>{invalidBatchDrafts.length} needs review</Badge>
                </div>

                {batchDrafts.length === 0 ? (
                  <div className="empty-spotlight">
                    <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>No batch rows yet.</p>
                    <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                      Paste shortcuts into the list or use the quick composer to start building the batch.
                    </p>
                  </div>
                ) : (
                  <Table className="md:min-w-0">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Line</TableHead>
                        <TableHead>Rule</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-28 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchDrafts.map((draft) => {
                        const isEditingBatchDraft = editingBatchDraftLine === draft.lineNumber

                        return (
                          <TableRow
                            key={draft.lineNumber}
                            className={isEditingBatchDraft ? 'bg-[rgba(6,182,212,0.09)] supports-[backdrop-filter]:backdrop-blur-[8px]' : undefined}
                          >
                            <TableCell className="font-medium">#{draft.lineNumber}</TableCell>
                            <TableCell className="whitespace-normal">
                              {isEditingBatchDraft ? (
                                <div className="grid min-w-0 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2">
                                  <Input
                                    value={editingBatchDraftShortcutText}
                                    onChange={(event) => {
                                      const nextShortcutText = event.target.value
                                      setBatchCreateState((current) => ({
                                        ...current,
                                        editingBatchDraftShortcutText: nextShortcutText,
                                      }))
                                    }}
                                    placeholder="Ctrl+K"
                                    disabled={busy}
                                  />
                                  <Input
                                    value={editingBatchDraftNoteText}
                                    onChange={(event) => {
                                      const nextNoteText = event.target.value
                                      setBatchCreateState((current) => ({
                                        ...current,
                                        editingBatchDraftNoteText: nextNoteText,
                                      }))
                                    }}
                                    placeholder="Optional note"
                                    disabled={busy}
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div style={{ color: 'var(--text)' }}>{draft.shortcut?.displayName ?? (draft.shortcutText || draft.rawLine)}</div>
                                  <div className="text-xs leading-5" style={{ color: draft.noteText ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                                    {draft.noteText || 'No note'}
                                  </div>
                                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{draft.rawLine}</div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              <div className="space-y-1">
                                <Badge variant={draft.error ? 'destructive' : 'success'}>{draft.error ? 'Fix line' : 'Ready'}</Badge>
                                <p className="m-0 text-xs leading-5" style={{ color: draft.error ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                                  {draft.error ?? `VK ${draft.shortcut?.virtualKeyCode}`}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2 sm:items-end">
                                {isEditingBatchDraft ? (
                                  <>
                                    <Button type="button" size="xs" variant="info" onClick={saveBatchDraftEdit} disabled={busy}>
                                      Save
                                    </Button>
                                    <Button type="button" size="xs" variant="outline" onClick={resetBatchDraftEditor} disabled={busy}>
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button type="button" size="xs" variant="info" onClick={() => startEditingBatchDraft(draft)} disabled={busy}>
                                      Edit
                                    </Button>
                                    <Button type="button" size="xs" variant="destructive" onClick={() => deleteBatchDraft(draft.lineNumber)} disabled={busy}>
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </section>

              {batchCreateError ? <p className="error-text m-0">{batchCreateError}</p> : null}
            </div>
          </div>
          <DialogFooter className="mt-auto">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleBatchCreateSubmit()} disabled={busy || batchReadyCount === 0 || invalidBatchDrafts.length > 0}>
              Create rules
            </Button>
          </DialogFooter>
        </div>
      </DialogSheetContent>
    </Dialog>
  )
}