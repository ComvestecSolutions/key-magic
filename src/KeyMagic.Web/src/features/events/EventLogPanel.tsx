import { useDeferredValue, useState } from 'react'
import type { ShortcutEvent } from '../../app/types'
import { SectionCard } from '../../shared/SectionCard'

interface EventLogPanelProps {
  events: ShortcutEvent[]
  busy: boolean
  onClear: () => Promise<void>
}

export function EventLogPanel({ events, busy, onClear }: EventLogPanelProps) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const filteredEvents = events.filter((event) => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) {
      return true
    }

    return [event.shortcutDisplay, event.processName, event.windowTitle, event.ruleId]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  return (
    <SectionCard
      title="Event Log"
      subtitle="Observe what Key Magic blocked, what passed through, and where keyboard pressure is coming from."
      action={
        <button type="button" className="ghost-button" onClick={() => void onClear()} disabled={busy || events.length === 0}>
          Clear log
        </button>
      }
    >
      <div className="panel-toolbar">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter events" />
        <span className="pill-counter">{filteredEvents.length}</span>
      </div>

      <div className="event-table-wrapper">
        <table className="event-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Shortcut</th>
              <th>Process</th>
              <th>Window</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted-text">No events matched the current filter.</td>
              </tr>
            ) : null}
            {filteredEvents.map((event) => (
              <tr key={`${event.timestamp}-${event.ruleId}-${event.processName}`}>
                <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                <td>{event.shortcutDisplay}</td>
                <td>{event.processName || 'Unknown'}</td>
                <td>{event.windowTitle || 'Untitled window'}</td>
                <td>
                  <span className={`rule-badge ${event.wasBlocked ? 'rule-badge--enabled' : 'rule-badge--pass'}`}>
                    {event.wasBlocked ? 'Blocked' : 'Passed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
