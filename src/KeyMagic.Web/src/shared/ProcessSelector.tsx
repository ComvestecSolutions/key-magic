import { useId, useState } from 'react'
import type { ProcessInfo } from '../app/types'

interface ProcessSelectorProps {
  availableProcesses: ProcessInfo[]
  selected: string[]
  onChange: (value: string[]) => void
}

export function ProcessSelector({ availableProcesses, selected, onChange }: ProcessSelectorProps) {
  const [inputValue, setInputValue] = useState('')
  const listId = useId()

  const options = availableProcesses
    .map((processInfo) => processInfo.processName)
    .filter((name, index, values) => values.indexOf(name) === index)

  function addProcess(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }

    if (!selected.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...selected, trimmed])
    }
    setInputValue('')
  }

  return (
    <div className="process-selector">
      <div className="process-selector__input-row">
        <input
          list={listId}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Add a process name or leave empty for global scope"
        />
        <button type="button" className="ghost-button" onClick={() => addProcess(inputValue)}>
          Add
        </button>
      </div>
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <div className="chip-list">
        {selected.length === 0 ? <span className="muted-text">Applies everywhere</span> : null}
        {selected.map((item) => (
          <button
            key={item}
            type="button"
            className="chip"
            onClick={() => onChange(selected.filter((entry) => entry !== item))}
          >
            {item}
            <span aria-hidden="true">x</span>
          </button>
        ))}
      </div>
    </div>
  )
}
