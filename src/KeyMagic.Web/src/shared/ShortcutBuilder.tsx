import { useEffect, useMemo, useState } from 'react'
import { Keyboard, X } from 'lucide-react'
import { buildShortcutDisplay, getKeyLabelFromKeyboardKey, isModifierOnlyKey, shortcutQuickKeys } from '../app/shortcuts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShortcutReference } from './ShortcutReference'

const modifierOrder = [
  { key: 'ctrl', label: 'Ctrl' },
  { key: 'alt', label: 'Alt' },
  { key: 'shift', label: 'Shift' },
  { key: 'win', label: 'Win' },
] as const

export interface ShortcutBuilderValue {
  keyLabel: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  win: boolean
}

interface ShortcutBuilderProps {
  value: ShortcutBuilderValue
  onChange: (value: ShortcutBuilderValue) => void
  disabled?: boolean
}

export function ShortcutBuilder({ value, onChange, disabled = false }: ShortcutBuilderProps) {
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    if (!isCapturing || disabled) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      event.preventDefault()
      event.stopPropagation()

      const nextValue = {
        keyLabel: value.keyLabel,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        win: event.metaKey,
      }

      if (isModifierOnlyKey(event.key)) {
        onChange(nextValue)
        return
      }

      const keyLabel = getKeyLabelFromKeyboardKey(event.key)
      if (!keyLabel) {
        return
      }

      onChange({ ...nextValue, keyLabel })
      setIsCapturing(false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [disabled, isCapturing, onChange, value])

  useEffect(() => {
    if (disabled && isCapturing) {
      setIsCapturing(false)
    }
  }, [disabled, isCapturing])

  const preview = useMemo(() => {
    if (value.keyLabel) {
      return buildShortcutDisplay(value.keyLabel, value)
    }

    const activeModifiers = modifierOrder.filter((modifier) => value[modifier.key]).map((modifier) => modifier.label)
    return activeModifiers.length > 0 ? `${activeModifiers.join(' + ')} + Key` : 'Press a key combination'
  }, [value])

  function updateModifier(key: keyof ShortcutBuilderValue) {
    onChange({ ...value, [key]: !value[key] })
  }

  function setKeyLabel(keyLabel: string) {
    onChange({ ...value, keyLabel })
  }

  function clearShortcut() {
    onChange({ keyLabel: '', ctrl: false, alt: false, shift: false, win: false })
    setIsCapturing(false)
  }

  return (
    <div className="glass-panel space-y-3.5 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="ui-eyebrow">
          Shortcut
        </p>
        <Badge variant={isCapturing ? 'default' : 'outline'}>{isCapturing ? 'Listening' : 'Ready'}</Badge>
      </div>

      <div className="glass-surface space-y-3 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="ui-eyebrow ui-eyebrow--tight">
              Preview
            </p>
            <p className="ui-section-title">
              {preview}
            </p>
          </div>
          <Button
            type="button"
            variant={isCapturing ? 'default' : 'outline'}
            onClick={() => setIsCapturing((current) => !current)}
            disabled={disabled}
          >
            <Keyboard className="size-4" />
            {isCapturing ? 'Listening' : 'Capture'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {modifierOrder.map((modifier) => {
            const active = value[modifier.key]
            return (
              <Button
                key={modifier.key}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className={active ? 'border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.12)] text-[var(--amber)]' : undefined}
                onClick={() => updateModifier(modifier.key)}
              >
                {modifier.label}
              </Button>
            )
          })}
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={value.keyLabel}
            onChange={(event) => setKeyLabel(event.target.value)}
            placeholder="K, Enter, F5, /, or ;"
            disabled={disabled}
          />
          {/*
            The Clear button remains enabled if any shortcut value is set, even when parent 'disabled' is true,
            to allow users to clear the shortcut while inputs are disabled (e.g., in a locked or review state).
            If you want Clear to always be disabled when editing is disabled, use disabled={disabled} instead.
          */}
          <Button type="button" variant="ghost" onClick={clearShortcut} disabled={disabled && !value.keyLabel && !value.ctrl && !value.alt && !value.shift && !value.win}>
            <X className="size-4" />
            Clear
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="ui-eyebrow">
          Quick Picks
        </p>
        <div className="flex flex-wrap gap-2">
          {shortcutQuickKeys.map((keyLabel) => (
            <Button
              key={keyLabel}
              type="button"
              variant="outline"
              size="xs"
              disabled={disabled}
              onClick={() => setKeyLabel(keyLabel)}
            >
              {keyLabel}
            </Button>
          ))}
        </div>
      </div>

      <ShortcutReference
        title="Key listing"
        description="Use Ctrl, Alt, Shift, or Win before any listed key. Click a key to place it into the current shortcut."
        onSelectKey={setKeyLabel}
        disabled={disabled}
      />
    </div>
  )
}