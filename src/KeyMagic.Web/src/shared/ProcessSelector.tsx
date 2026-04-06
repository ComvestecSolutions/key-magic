import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { ProcessInfo } from '../app/types'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ProcessSelectorProps {
  availableProcesses: ProcessInfo[]
  selected: string[]
  onChange: (value: string[]) => void
}

export function ProcessSelector({ availableProcesses, selected, onChange }: ProcessSelectorProps) {
  const [inputValue, setInputValue] = useState('')
  const [scopeMode, setScopeMode] = useState<'global' | 'scoped'>(selected.length > 0 ? 'scoped' : 'global')

  useEffect(() => {
    if (selected.length > 0) {
      setScopeMode('scoped')
    }
  }, [selected.length])

  const options = useMemo(() => {
    const byProcess = new Map<string, ProcessInfo>()
    for (const processInfo of availableProcesses) {
      const existing = byProcess.get(processInfo.processName)
      if (!existing || processInfo.instanceCount > existing.instanceCount) {
        byProcess.set(processInfo.processName, processInfo)
      }
    }

    return [...byProcess.values()].sort((left, right) => right.instanceCount - left.instanceCount || left.processName.localeCompare(right.processName))
  }, [availableProcesses])

  const suggestions = options
    .filter((option) => !selected.some((entry) => entry.toLowerCase() === option.processName.toLowerCase()))
    .filter((option) => {
      const query = inputValue.trim().toLowerCase()
      if (!query) return true
      return option.processName.toLowerCase().includes(query) || option.windowTitle.toLowerCase().includes(query)
    })
    .slice(0, 8)

  function addProcess(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    if (!selected.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...selected, trimmed])
    }
    setScopeMode('scoped')
    setInputValue('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addProcess(inputValue)
    }
  }

  return (
    <div className="process-selector glass-panel p-3.5">
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="ui-eyebrow">
            Scope
          </p>
          <Badge variant={scopeMode === 'global' ? 'info' : 'warning'}>
            {scopeMode === 'global' ? 'All apps' : `${selected.length} app${selected.length === 1 ? '' : 's'}`}
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant={scopeMode === 'global' ? 'info' : 'outline'}
            onClick={() => {
              setScopeMode('global')
              if (selected.length > 0) {
                onChange([])
              }
            }}
          >
            All apps
          </Button>
          <Button
            type="button"
            variant={scopeMode === 'scoped' ? 'warning' : 'outline'}
            onClick={() => setScopeMode('scoped')}
          >
            Specific apps
          </Button>
        </div>

        {scopeMode === 'global' ? (
          <div className="glass-surface px-3 py-2.5 ui-copy-xs">
            Applies everywhere.
          </div>
        ) : (
          <>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add chrome.exe or slack.exe"
              />
              <Button type="button" variant="outline" onClick={() => addProcess(inputValue)}>
                Add app
              </Button>
              <Button type="button" variant="ghost" onClick={() => onChange([])} disabled={selected.length === 0}>
                Clear
              </Button>
            </div>

            {suggestions.length > 0 ? (
              <div className="space-y-2">
                <p className="ui-eyebrow">
                  Suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((option) => (
                    <Tooltip key={option.processName}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="info"
                          size="xs"
                          className="gap-1.5"
                          onClick={() => addProcess(option.processName)}
                        >
                          {option.processName}
                          <span className="opacity-70">{option.instanceCount}x</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="space-y-1">
                        <p className="m-0 font-semibold">{option.processName}</p>
                        <p className="m-0 text-[11px] leading-5 text-[var(--text-secondary)]">
                          {option.windowTitle || 'No active window title available.'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="ui-eyebrow">
                Selected apps
              </p>
              <div className="chip-list">
                {selected.length === 0 ? (
                  <div className="empty-spotlight w-full">
                    <p className="ui-title-sm">
                      No apps selected.
                    </p>
                    <p className="ui-copy-xs">
                      Add one or more executables.
                    </p>
                  </div>
                ) : null}
                {selected.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant="warning"
                    size="xs"
                    className="gap-1.5"
                    onClick={() => onChange(selected.filter((entry) => entry !== item))}
                  >
                    {item}
                    <X className="size-3" aria-hidden="true" />
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
