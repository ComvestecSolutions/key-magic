import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  confirmVariant?: 'default' | 'destructive'
  busy?: boolean
  onConfirm: () => Promise<void> | void
  onError?: (err: Error) => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'default',
  busy = false,
  onConfirm,
  onError,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) {
      setPending(false)
    }
  }, [open])

  const confirmBusy = busy || pending

  async function handleConfirm() {
    if (confirmBusy) {
      return
    }

    setPending(true)

    try {
      await onConfirm()
    } catch (confirmError) {
      console.error('Confirm dialog action failed.', confirmError)
      const error = confirmError instanceof Error ? confirmError : new Error('Confirm dialog action failed.')
      onError?.(error)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={confirmBusy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} onClick={() => void handleConfirm()} disabled={confirmBusy}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}