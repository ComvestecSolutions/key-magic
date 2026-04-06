import { shortcutReferenceGroups } from '../app/shortcuts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ShortcutReferenceProps {
  title?: string
  description?: string
  className?: string
  onSelectKey?: (keyLabel: string) => void
  disabled?: boolean
}

export function ShortcutReference({
  title = 'Supported key names',
  description,
  className,
  onSelectKey,
  disabled = false,
}: ShortcutReferenceProps) {
  return (
    <div className={cn('glass-surface space-y-3 p-3.5', className)}>
      <div className="space-y-1">
        <p className="ui-eyebrow">{title}</p>
        {description ? <p className="ui-copy-xs">{description}</p> : null}
      </div>

      <div className="space-y-2.5">
        {shortcutReferenceGroups.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="ui-eyebrow ui-eyebrow--tight">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.keys.map((keyLabel) => (
                onSelectKey ? (
                  <Button
                    key={`${group.label}-${keyLabel}`}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onSelectKey(keyLabel)}
                    disabled={disabled}
                  >
                    {keyLabel}
                  </Button>
                ) : (
                  <Badge key={`${group.label}-${keyLabel}`} variant="outline">
                    {keyLabel}
                  </Badge>
                )
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}