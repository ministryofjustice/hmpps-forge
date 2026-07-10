import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import type { TraceUnitMessage } from '../hooks/useConnection'
import { clearBlockHighlight, highlightBlock } from '../blockHighlight'

function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (ms >= 1) {
    return `${ms.toFixed(2)}ms`
  }

  return `${(ms * 1000).toFixed(1)}µs`
}

function formatKind(kind: string): string {
  return kind.replaceAll('-', ' ').replaceAll('.', ' ')
}

function shortNodeId(nodeId: string): string {
  const segments = nodeId.split('::')

  return segments[segments.length - 1]
}

// --- Block reference detection ---

interface BlockReference {
  readonly id: string
  readonly variant: string
  readonly blockType: string
  readonly properties: Record<string, unknown>
}

function isBlockReference(value: unknown): value is BlockReference {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const obj = value as Record<string, unknown>

  return typeof obj.id === 'string' && typeof obj.variant === 'string' && typeof obj.blockType === 'string'
}

function findMatchingUnit(traceUnits: readonly TraceUnitMessage[], blockRef: BlockReference): TraceUnitMessage | undefined {
  return traceUnits.find(unit => unit.kind === 'resolve.block' && unit.nodeId === blockRef.id)
}

// --- Property tree ---

interface PropertyContext {
  readonly traceUnits: readonly TraceUnitMessage[]
  readonly onSelectUnit: (unit: TraceUnitMessage | undefined) => void
}

function BlockRefChip({ blockRef, context }: { readonly blockRef: BlockReference; readonly context: PropertyContext }) {
  const childUnit = findMatchingUnit(context.traceUnits, blockRef)

  const handleClick = () => {
    if (childUnit) {
      context.onSelectUnit(childUnit)
    }
  }

  return (
    <button
      type="button"
      class={`block-ref${childUnit ? '' : ' block-ref--inactive'}`}
      onClick={childUnit ? handleClick : undefined}
      onMouseEnter={childUnit ? () => highlightBlock(blockRef.id, blockRef.variant) : undefined}
      onMouseLeave={childUnit ? clearBlockHighlight : undefined}
      title={blockRef.id}
    >
      {blockRef.variant}
    </button>
  )
}

function PropertyValue({ value }: { readonly value: unknown }) {
  if (value === undefined) {
    return <span class="property-value property-value--null">undefined</span>
  }

  if (value === null) {
    return <span class="property-value property-value--null">null</span>
  }

  if (typeof value === 'string') {
    return <span class="property-value property-value--string">&quot;{value}&quot;</span>
  }

  if (typeof value === 'number') {
    return <span class="property-value property-value--number">{value}</span>
  }

  if (typeof value === 'boolean') {
    return <span class="property-value property-value--boolean">{String(value)}</span>
  }

  return <span class="property-value">{String(value)}</span>
}

function PropertyRow({ name, value, context }: { readonly name: string; readonly value: unknown; readonly context: PropertyContext }) {
  const [expanded, setExpanded] = useState(false)

  if (isBlockReference(value)) {
    return (
      <div class="property-row">
        <div class="property-row__line">
          <span class="property-row__spacer" />
          <span class="property-row__name">{name}</span>
          <BlockRefChip blockRef={value} context={context} />
        </div>
      </div>
    )
  }

  if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.keys(value as Record<string, unknown>)
    const toggleClass = `property-row__toggle${expanded ? ' property-row__toggle--expanded' : ''}`
    const toggleLabel = expanded ? `Collapse ${name}` : `Expand ${name}`

    return (
      <div class="property-row">
        <div class="property-row__line">
          <button type="button" class={toggleClass} aria-label={toggleLabel} aria-expanded={expanded} onClick={() => setExpanded(!expanded)} />
          <span class="property-row__name">{name}</span>
          <span class="property-row__preview">{`{${entries.length}}`}</span>
        </div>
        {expanded && (
          <div class="property-row__children">
            {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
              <PropertyRow key={k} name={k} value={v} context={context} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (Array.isArray(value)) {
    const toggleClass = `property-row__toggle${expanded ? ' property-row__toggle--expanded' : ''}`
    const toggleLabel = expanded ? `Collapse ${name}` : `Expand ${name}`
    const allBlocks = value.length > 0 && value.every(isBlockReference)

    return (
      <div class="property-row">
        <div class="property-row__line">
          <button type="button" class={toggleClass} aria-label={toggleLabel} aria-expanded={expanded} onClick={() => setExpanded(!expanded)} />
          <span class="property-row__name">{name}</span>
          <span class="property-row__preview">
            {allBlocks
              ? `[${value.map((item: BlockReference) => item.variant).join(', ')}]`
              : `Array(${value.length})`}
          </span>
        </div>
        {expanded && (
          <div class="property-row__children">
            {value.map((item, i) => (
              <PropertyRow key={i} name={String(i)} value={item} context={context} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div class="property-row">
      <div class="property-row__line">
        <span class="property-row__spacer" />
        <span class="property-row__name">{name}</span>
        <PropertyValue value={value} />
      </div>
    </div>
  )
}

// --- Unit detail ---

interface UnitDetailProps {
  readonly unit: TraceUnitMessage
  readonly swatchColor: { readonly fill: string; readonly border: string }
  readonly traceUnits: readonly TraceUnitMessage[]
  readonly onSelectUnit: (unit: TraceUnitMessage | undefined) => void
}

export default function UnitDetail({ unit, swatchColor, traceUnits, onSelectUnit }: UnitDetailProps) {
  // Clear any page highlight when the shown unit changes or the panel closes.
  useEffect(() => () => clearBlockHighlight(), [unit])

  const context: PropertyContext = {
    traceUnits,
    onSelectUnit,
  }

  const ownProperties = unit.properties ?? {}
  const hasOwnProps = Object.keys(ownProperties).length > 0

  // Render block units carry no properties payload of their own, but share their nodeId with the
  // resolve.block unit that holds the resolved block properties — borrow those when we have none.
  const borrowedUnit = !hasOwnProps && unit.nodeId !== undefined
    ? traceUnits.find(
        candidate =>
          candidate.kind === 'resolve.block' &&
          candidate.nodeId === unit.nodeId &&
          candidate.properties !== undefined &&
          Object.keys(candidate.properties).length > 0,
      )
    : undefined

  const properties = hasOwnProps ? ownProperties : borrowedUnit?.properties ?? {}
  const hasProps = Object.keys(properties).length > 0
  const sectionTitle = !hasOwnProps && borrowedUnit !== undefined ? 'Props (resolved block)' : 'Props'

  return (
    <div class="unit-detail">
      <div class="unit-detail__col">
        <div class="unit-detail__kind">
          <span class="unit-detail__swatch" style={{ background: swatchColor.fill, borderColor: swatchColor.border }} />
          {formatKind(unit.kind)}
        </div>
        <dl class="unit-detail__metadata">
          {unit.nodeId && (
            <div class="unit-detail__meta-row">
              <dt class="unit-detail__meta-label">Node ID</dt>
              <dd class="unit-detail__meta-value unit-detail__meta-value--mono">{shortNodeId(unit.nodeId)}</dd>
            </div>
          )}
          {unit.durationMs !== undefined && (
            <div class="unit-detail__meta-row">
              <dt class="unit-detail__meta-label">Duration</dt>
              <dd class="unit-detail__meta-value">{formatMs(unit.durationMs)}</dd>
            </div>
          )}
          {unit.selfDurationMs !== undefined && (
            <div class="unit-detail__meta-row">
              <dt class="unit-detail__meta-label">Self time</dt>
              <dd class="unit-detail__meta-value">{formatMs(unit.selfDurationMs)}</dd>
            </div>
          )}
        </dl>
      </div>

      <div class="unit-detail__col unit-detail__col--tree">
        <div class="unit-detail__section-title">{sectionTitle}</div>
        {hasProps ? (
          <div class="unit-detail__props">
            {Object.entries(properties).map(([key, value]) => (
              <PropertyRow key={key} name={key} value={value} context={context} />
            ))}
          </div>
        ) : (
          <div class="unit-detail__no-props">No props</div>
        )}
      </div>
    </div>
  )
}
