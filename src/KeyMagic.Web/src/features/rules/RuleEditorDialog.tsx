import { useCallback, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { buildShortcutDisplay } from '../../app/shortcuts'
import type { ProcessInfo } from '../../app/types'
import { FormField } from '../../shared/FormField'
import { ProcessSelector } from '../../shared/ProcessSelector'
import { ShortcutBuilder, type ShortcutBuilderValue } from '../../shared/ShortcutBuilder'
import type { RuleEditorFormState } from './blockingRuleDialogTypes'
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

interface RuleEditorDialogProps {
  editorOpen: boolean
  onOpenChange: (open: boolean) => void
  form: RuleEditorFormState
  setForm: Dispatch<SetStateAction<RuleEditorFormState>>
  editingId: string | null
  closeEditor: () => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  error: string | null
  busy: boolean
  processes: ProcessInfo[]
}

export function RuleEditorDialog({
  editorOpen,
  onOpenChange,
  form,
  setForm,
  editingId,
  closeEditor,
  handleSubmit,
  error,
  busy,
  processes,
}: RuleEditorDialogProps) {
  const shortcutPreview = form.keyLabel ? buildShortcutDisplay(form.keyLabel, form) : 'No shortcut selected'
  const notePreview = form.description.trim() || 'Add a short note if this block needs extra operator context.'
  const scopePreview = form.targetProcesses.length === 0 ? 'All applications' : `${form.targetProcesses.length} scoped app${form.targetProcesses.length === 1 ? '' : 's'}`
  const scopePreviewCopy = form.targetProcesses.length === 0
    ? 'The rule will intercept this shortcut in every application.'
    : 'Only the selected applications will be affected.'

  const handleShortcutChange = useCallback((nextValue: ShortcutBuilderValue) => {
    setForm((current) => ({ ...current, ...nextValue }))
  }, [setForm])

  return (
    <Dialog open={editorOpen} onOpenChange={onOpenChange}>
      <DialogSheetContent className="md:max-w-[66rem]">
        <form className="editor-sheet" onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader className="pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{editingId ? 'Edit rule' : 'New rule'}</DialogTitle>
              <Badge variant={editingId ? 'secondary' : 'outline'}>{editingId ? 'Editing' : 'Create'}</Badge>
            </div>
            <DialogDescription>
              {editingId ? 'Update shortcut, note, or scope.' : 'Create a shortcut block.'}
            </DialogDescription>
          </DialogHeader>

          <div className="editor-sheet__body editor-sheet__body--balanced">
            <div className="editor-sheet__main">
              <section className="editor-sheet__section space-y-4">
                <div className="editor-sheet__section-header">
                  <div className="editor-sheet__section-copy">
                    <p className="ui-eyebrow m-0">Trigger and context</p>
                    <p className="ui-copy-xs">
                      Capture the shortcut first, then add a short note if the rule needs operator context.
                    </p>
                  </div>
                  <Badge variant={editingId ? 'secondary' : 'outline'}>{editingId ? 'Editing live rule' : 'New blocking rule'}</Badge>
                </div>

                <FormField label="Trigger" required>
                  <ShortcutBuilder
                    value={form}
                    onChange={handleShortcutChange}
                    disabled={busy}
                  />
                </FormField>

                <FormField label="Note" hint="Optional" description="Give the rule a short explanation for the next operator.">
                  <Input
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Block assistant overlay"
                    disabled={busy}
                  />
                </FormField>
              </section>
            </div>

            <div className="editor-sheet__side">
              <section className="editor-sheet__aside space-y-4">
                <div className="editor-sheet__preview">
                  <p className="ui-eyebrow ui-eyebrow--tight">Preview</p>
                  <div className="space-y-1.5">
                    <p className="m-0 text-base font-semibold tracking-[-0.02em]" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                      {shortcutPreview}
                    </p>
                    <p className="ui-copy-xs">{notePreview}</p>
                  </div>
                </div>

                <div className="editor-sheet__preview">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="ui-eyebrow ui-eyebrow--tight">Coverage</p>
                      <p className="m-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>{scopePreview}</p>
                      <p className="ui-copy-xs">{scopePreviewCopy}</p>
                    </div>
                    <Badge variant={form.targetProcesses.length === 0 ? 'warning' : 'info'}>
                      {form.targetProcesses.length === 0 ? 'Global' : 'Scoped'}
                    </Badge>
                  </div>
                </div>

                <div className="shell-divider" />

                <div className="editor-sheet__section-header">
                  <div className="editor-sheet__section-copy">
                    <p className="ui-eyebrow m-0">Coverage</p>
                    <p className="ui-copy-xs">
                      Scope the rule to specific apps when you want targeted protection instead of a global block.
                    </p>
                  </div>
                  <Badge variant={form.targetProcesses.length === 0 ? 'warning' : 'info'}>
                    {form.targetProcesses.length === 0 ? 'Global coverage' : 'Scoped coverage'}
                  </Badge>
                </div>

                <FormField label="Scope" description="Leave the list empty to block this shortcut everywhere KeyMagic is active.">
                  <ProcessSelector
                    availableProcesses={processes}
                    selected={form.targetProcesses}
                    onChange={(targetProcesses) => setForm((current) => ({ ...current, targetProcesses }))}
                  />
                </FormField>
              </section>
            </div>
          </div>

          {error ? <p className="error-text m-0">{error}</p> : null}

          <DialogFooter className="mt-auto">
            <Button type="button" variant="outline" onClick={closeEditor} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {editingId ? 'Save rule' : 'Add rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogSheetContent>
    </Dialog>
  )
}