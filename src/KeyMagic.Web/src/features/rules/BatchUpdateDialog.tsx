import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { buildShortcutDisplay, getVirtualKeyCode } from '../../app/shortcuts'
import type { ProcessInfo } from '../../app/types'
import { FormField } from '../../shared/FormField'
import { ProcessSelector } from '../../shared/ProcessSelector'
import { ShortcutBuilder, type ShortcutBuilderValue } from '../../shared/ShortcutBuilder'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSheetContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface BatchUpdateDialogProps {
  batchUpdateOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  batchUpdateShortcut: ShortcutBuilderValue
  setBatchUpdateShortcut: Dispatch<SetStateAction<ShortcutBuilderValue>>
  replaceShortcut: boolean
  setReplaceShortcut: Dispatch<SetStateAction<boolean>>
  replaceDescription: boolean
  setReplaceDescription: Dispatch<SetStateAction<boolean>>
  replaceProcesses: boolean
  setReplaceProcesses: Dispatch<SetStateAction<boolean>>
  batchUpdateDescription: string
  setBatchUpdateDescription: Dispatch<SetStateAction<string>>
  batchUpdateProcesses: string[]
  setBatchUpdateProcesses: Dispatch<SetStateAction<string[]>>
  handleBatchUpdateSubmit: () => Promise<void>
  resetBatchUpdateState: () => void
  batchUpdateError: string | null
  setBatchUpdateError: Dispatch<SetStateAction<string | null>>
  busy: boolean
  processes: ProcessInfo[]
}

export function BatchUpdateDialog({
  batchUpdateOpen,
  onOpenChange,
  selectedIds,
  batchUpdateShortcut,
  setBatchUpdateShortcut,
  replaceShortcut,
  setReplaceShortcut,
  replaceDescription,
  setReplaceDescription,
  replaceProcesses,
  setReplaceProcesses,
  batchUpdateDescription,
  setBatchUpdateDescription,
  batchUpdateProcesses,
  setBatchUpdateProcesses,
  handleBatchUpdateSubmit,
  resetBatchUpdateState,
  batchUpdateError,
  setBatchUpdateError,
  busy,
  processes,
}: BatchUpdateDialogProps) {
  const batchUpdateScopeLabel = batchUpdateProcesses.length === 0 ? 'All apps' : `${batchUpdateProcesses.length} app${batchUpdateProcesses.length === 1 ? '' : 's'}`
  const batchUpdateChangeCount = Number(replaceShortcut) + Number(replaceDescription) + Number(replaceProcesses)
  const batchUpdateTriggerReady = getVirtualKeyCode(batchUpdateShortcut.keyLabel) !== null
  const batchUpdateShortcutPreview = batchUpdateShortcut.keyLabel
    ? buildShortcutDisplay(batchUpdateShortcut.keyLabel, batchUpdateShortcut)
    : 'Capture a shortcut to replace the trigger on every selected rule.'
  const batchUpdateSummary = batchUpdateChangeCount === 0
    ? 'Choose at least one shared field to apply across the current selection.'
    : `${batchUpdateChangeCount} shared field${batchUpdateChangeCount === 1 ? '' : 's'} will be applied to ${selectedIds.length} selected rule${selectedIds.length === 1 ? '' : 's'}.`
  const batchUpdateNotePreview = replaceDescription
    ? batchUpdateDescription.trim() || 'The existing note will be cleared on every selected rule.'
    : 'Leave note replacement off to preserve the current note on each rule.'
  const batchUpdateScopePreviewCopy = replaceProcesses
    ? batchUpdateProcesses.length === 0
      ? 'Every selected rule will become global across all apps.'
      : `Every selected rule will target the same ${batchUpdateProcesses.length} selected app${batchUpdateProcesses.length === 1 ? '' : 's'}.`
    : 'Leave scope replacement off to preserve each rule\'s current coverage.'
  const hasUpdates = batchUpdateChangeCount > 0

  const handleShortcutChange = useCallback((nextValue: ShortcutBuilderValue) => {
    setBatchUpdateError(null)
    setBatchUpdateShortcut(nextValue)
  }, [setBatchUpdateError, setBatchUpdateShortcut])

  function handleOpenChange(open: boolean) {
    onOpenChange(open)
    if (!open) {
      resetBatchUpdateState()
    }
  }

  return (
    <Dialog open={batchUpdateOpen} onOpenChange={handleOpenChange}>
      <DialogSheetContent className="md:max-w-[66rem]">
        <div className="editor-sheet">
          <DialogHeader className="pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>Edit shared fields</DialogTitle>
              <Badge variant={selectedIds.length > 0 ? 'info' : 'outline'}>
                {selectedIds.length} selected
              </Badge>
            </div>
            <DialogDescription>Apply one captured shortcut, note, or scope change to the current selection.</DialogDescription>
          </DialogHeader>

          <div className="editor-sheet__body editor-sheet__body--balanced">
            <div className="editor-sheet__main">
              <section className="editor-sheet__section space-y-4">
                <div className="editor-sheet__section-header">
                  <div className="editor-sheet__section-copy">
                    <p className="ui-eyebrow m-0">Trigger update</p>
                    <p className="ui-copy-xs">
                      Capture one new shortcut when the whole selection should switch to the same trigger.
                    </p>
                  </div>
                  <Badge variant={replaceShortcut ? 'success' : 'outline'}>
                    {replaceShortcut ? 'Will replace' : 'Optional'}
                  </Badge>
                </div>

                <div className="glass-surface space-y-3 p-3.5">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={replaceShortcut} onCheckedChange={(checked) => setReplaceShortcut(Boolean(checked))} disabled={busy} />
                    <div className="space-y-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Replace shortcut</span>
                      <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                        Capture one trigger and apply it to every selected rule.
                      </p>
                    </div>
                  </div>

                  {replaceShortcut ? (
                    <div className="space-y-3">
                      <ShortcutBuilder
                        value={batchUpdateShortcut}
                        onChange={handleShortcutChange}
                        disabled={busy}
                      />

                      <div className="editor-sheet__preview">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5">
                            <p className="ui-eyebrow ui-eyebrow--tight">Shared trigger preview</p>
                            <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>{batchUpdateShortcutPreview}</p>
                            <p className="ui-copy-xs">
                              {batchUpdateTriggerReady ? 'Every selected rule will adopt this trigger.' : 'Capture a supported shortcut before applying the update.'}
                            </p>
                          </div>
                          <Badge variant={batchUpdateTriggerReady ? 'success' : 'outline'}>
                            {batchUpdateTriggerReady ? 'Ready to apply' : 'Capture needed'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="editor-sheet__section space-y-4">
                <div className="editor-sheet__section-header">
                  <div className="editor-sheet__section-copy">
                    <p className="ui-eyebrow m-0">Note update</p>
                    <p className="ui-copy-xs">
                      Replace or clear the operator note across the current selection in one pass.
                    </p>
                  </div>
                  <Badge variant={replaceDescription ? 'info' : 'outline'}>
                    {replaceDescription ? 'Will replace' : 'Optional'}
                  </Badge>
                </div>

                <div className="glass-surface space-y-3 p-3.5">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={replaceDescription} onCheckedChange={(checked) => setReplaceDescription(Boolean(checked))} disabled={busy} />
                    <div className="space-y-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Replace note</span>
                      <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                        Leave the field blank when you want to clear the existing note on the selection.
                      </p>
                    </div>
                  </div>

                  {replaceDescription ? (
                    <Input
                      value={batchUpdateDescription}
                      onChange={(event) => setBatchUpdateDescription(event.target.value)}
                      placeholder="Shared note"
                      disabled={busy}
                    />
                  ) : null}
                </div>
              </section>

              <section className="editor-sheet__section space-y-4">
                <div className="editor-sheet__section-header">
                  <div className="editor-sheet__section-copy">
                    <p className="ui-eyebrow m-0">Scope update</p>
                    <p className="ui-copy-xs">
                      Apply one shared scope when the selected rules should target the same applications.
                    </p>
                  </div>
                  <Badge variant={replaceProcesses ? 'info' : 'outline'}>
                    {replaceProcesses ? 'Will replace' : 'Optional'}
                  </Badge>
                </div>

                <div className="glass-surface space-y-3 p-3.5">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={replaceProcesses} onCheckedChange={(checked) => setReplaceProcesses(Boolean(checked))} disabled={busy} />
                    <div className="space-y-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Replace scope</span>
                      <p className="m-0 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                        Leave the app list empty if the updated rules should become global.
                      </p>
                    </div>
                  </div>

                  {replaceProcesses ? (
                    <FormField label="Scope">
                      <ProcessSelector
                        availableProcesses={processes}
                        selected={batchUpdateProcesses}
                        onChange={setBatchUpdateProcesses}
                      />
                    </FormField>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="editor-sheet__side">
              <div className="insight-strip">
                <article className="metric-tile">
                  <span className="metric-tile__eyebrow">Selected</span>
                  <strong className="metric-tile__value">{selectedIds.length}</strong>
                </article>
                <article className="metric-tile">
                  <span className="metric-tile__eyebrow">Active changes</span>
                  <strong className="metric-tile__value" style={{ color: batchUpdateChangeCount > 0 ? 'var(--amber)' : 'var(--text-secondary)' }}>
                    {batchUpdateChangeCount}
                  </strong>
                </article>
                <article className="metric-tile">
                  <span className="metric-tile__eyebrow">Scope</span>
                  <strong className="metric-tile__value" style={{ color: replaceProcesses ? 'var(--cyan)' : 'var(--text-secondary)' }}>
                    {batchUpdateScopeLabel}
                  </strong>
                </article>
              </div>

              <section className="editor-sheet__aside space-y-4">
                <div className="editor-sheet__section-header">
                  <div className="editor-sheet__section-copy">
                    <p className="ui-eyebrow m-0">Update summary</p>
                    <p className="ui-copy-xs">{batchUpdateSummary}</p>
                  </div>
                  <Badge variant={batchUpdateChangeCount > 0 ? 'info' : 'outline'}>
                    {batchUpdateChangeCount > 0 ? 'Ready to review' : 'Waiting for changes'}
                  </Badge>
                </div>

                <div className="editor-sheet__preview">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="ui-eyebrow ui-eyebrow--tight">Trigger</p>
                      <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {replaceShortcut ? batchUpdateShortcutPreview : 'No trigger replacement'}
                      </p>
                      <p className="ui-copy-xs">
                        {replaceShortcut
                          ? batchUpdateTriggerReady
                            ? 'Every selected rule will adopt this trigger.'
                            : 'Capture a supported shortcut before applying the update.'
                          : 'Leave trigger replacement off to preserve the current shortcut on each rule.'}
                      </p>
                    </div>
                    <Badge variant={replaceShortcut ? (batchUpdateTriggerReady ? 'success' : 'warning') : 'outline'}>
                      {replaceShortcut ? (batchUpdateTriggerReady ? 'Replace' : 'Needs capture') : 'Keep existing'}
                    </Badge>
                  </div>
                </div>

                <div className="editor-sheet__preview">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="ui-eyebrow ui-eyebrow--tight">Note</p>
                      <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {replaceDescription ? (batchUpdateDescription.trim() || 'Clear note') : 'No note replacement'}
                      </p>
                      <p className="ui-copy-xs">{batchUpdateNotePreview}</p>
                    </div>
                    <Badge variant={replaceDescription ? 'info' : 'outline'}>
                      {replaceDescription ? 'Replace' : 'Keep existing'}
                    </Badge>
                  </div>
                </div>

                <div className="editor-sheet__preview">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="ui-eyebrow ui-eyebrow--tight">Scope</p>
                      <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {replaceProcesses ? batchUpdateScopeLabel : 'No scope replacement'}
                      </p>
                      <p className="ui-copy-xs">{batchUpdateScopePreviewCopy}</p>
                    </div>
                    <Badge variant={replaceProcesses ? 'info' : 'outline'}>
                      {replaceProcesses ? 'Replace' : 'Keep existing'}
                    </Badge>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {batchUpdateError ? <p className="error-text m-0">{batchUpdateError}</p> : null}

          <DialogFooter className="mt-auto">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleBatchUpdateSubmit()} disabled={busy || !hasUpdates}>
              Apply changes
            </Button>
          </DialogFooter>
        </div>
      </DialogSheetContent>
    </Dialog>
  )
}