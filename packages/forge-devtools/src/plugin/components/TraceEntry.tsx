import { h } from 'preact'
import type { TraceMessage } from '../hooks/useConnection'

interface TraceEntryProps {
  readonly trace: TraceMessage
  readonly selected: boolean
  readonly onClick: () => void
}

function formatOutcome(outcome: string): string {
  return outcome.charAt(0).toUpperCase() + outcome.slice(1)
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

export default function TraceEntry({ trace, selected, onClick }: TraceEntryProps) {
  return (
    <div class={`trace-entry${selected ? ' trace-entry--selected' : ''}`} onClick={onClick}>
      <span class={`trace-entry__method trace-entry__method--${trace.method.toLowerCase()}`}>{trace.method}</span>
      <span class="trace-entry__content">
        <span class="trace-entry__pathname">{trace.pathname}</span>
        <span class="trace-entry__meta">
          {formatTimestamp(trace.receivedAt)} - {formatOutcome(trace.trace.outcome)}
        </span>
      </span>
    </div>
  )
}
