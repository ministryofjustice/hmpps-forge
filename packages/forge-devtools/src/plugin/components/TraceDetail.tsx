import { h } from 'preact'
import type { TraceMessage } from '../hooks/useConnection'
import MetricCard from './MetricCard'

interface TraceDetailProps {
  readonly trace: TraceMessage | undefined
}

function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }

  return `${ms.toFixed(2)}ms`
}

function outcomeColor(outcome: string): string {
  if (outcome === 'render') {
    return 'var(--color-success)'
  }

  if (outcome === 'error') {
    return 'var(--color-error)'
  }

  return 'var(--accent)'
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function TraceDetail({ trace }: TraceDetailProps) {
  if (!trace) {
    return <div class="empty-state">Select a trace to view details</div>
  }

  const phaseNames = trace.trace.phases.map(p => p.phase).join(', ')

  return (
    <div class="trace-detail">
      <div class="trace-detail__header">
        <span class={`trace-entry__method trace-entry__method--${trace.method.toLowerCase()}`}>{trace.method}</span>
        <span class="trace-detail__pathname">{trace.pathname}</span>
      </div>
      {trace.route.stepTitle && <div class="trace-detail__step-title">{trace.route.stepTitle}</div>}
      <div class="trace-detail__node-id">{trace.nodeId}</div>

      <div class="trace-detail__cards">
        <MetricCard
          title="Duration"
          value={formatDuration(trace.trace.durationMs)}
        />
        <MetricCard
          title="Outcome"
          value={capitalize(trace.trace.outcome)}
          valueColor={outcomeColor(trace.trace.outcome)}
        />
        <MetricCard
          title="Phases"
          value={String(trace.trace.phases.length)}
          valueColor="var(--accent)"
          description={phaseNames}
        />
      </div>

      {trace.trace.error && (
        <div class="trace-detail__error">
          <div class="trace-detail__error-header">
            {trace.trace.error.status !== undefined && (
              <span class="trace-detail__error-status">{trace.trace.error.status}</span>
            )}
            <span class="trace-detail__error-message">{trace.trace.error.message}</span>
          </div>
          {trace.trace.error.stack && (
            <details class="trace-detail__error-stack">
              <summary>Stack trace</summary>
              <pre>{trace.trace.error.stack}</pre>
            </details>
          )}
        </div>
      )}

      <dl class="trace-detail__properties">
        <div class="trace-detail__property">
          <dt class="trace-detail__property-label">Package</dt>
          <dd class="trace-detail__property-value">{trace.route.journeyTitle}</dd>
        </div>
        {trace.route.formattedDslPath && (
          <div class="trace-detail__property">
            <dt class="trace-detail__property-label">DSL Path</dt>
            <dd class="trace-detail__property-value trace-detail__property-value--mono">{trace.route.formattedDslPath}</dd>
          </div>
        )}
        <div class="trace-detail__property">
          <dt class="trace-detail__property-label">Route</dt>
          <dd class="trace-detail__property-value trace-detail__property-value--mono">{trace.route.routeTemplatePath}</dd>
        </div>
        {trace.trace.redirect && (
          <div class="trace-detail__property">
            <dt class="trace-detail__property-label">Redirect</dt>
            <dd class="trace-detail__property-value trace-detail__property-value--mono">{trace.trace.redirect.target}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
