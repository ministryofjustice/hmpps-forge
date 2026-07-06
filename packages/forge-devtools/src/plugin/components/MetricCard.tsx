import { h } from 'preact'

interface MetricCardProps {
  readonly title: string
  readonly value: string
  readonly valueColor?: string
  readonly description?: string
}

export default function MetricCard({ title, value, valueColor, description }: MetricCardProps) {
  return (
    <div class="metric-card">
      <div class="metric-card__title">{title}</div>
      <div class="metric-card__value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      {description && <div class="metric-card__description">{description}</div>}
    </div>
  )
}
