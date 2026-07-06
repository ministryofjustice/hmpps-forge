import { Fragment, h } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { TraceMessage, TraceUnitMessage } from '../hooks/useConnection'
import { clearBlockHighlight, highlightBlock } from '../blockHighlight'

// --- Types ---

interface BlocksViewProps {
  readonly trace: TraceMessage | undefined
}

interface BlockNode {
  readonly nodeId: string
  readonly variant: string
  readonly isField: boolean
  readonly properties: Record<string, unknown>
  readonly children: readonly BlockNode[]
}

interface ValidationFailureMessage {
  readonly message: string
  readonly blockCode?: string
  readonly blockId?: string
  readonly groups?: readonly string[]
  readonly submissionOnly: boolean
}

interface StepValidityMessage {
  readonly fieldFailures: readonly ValidationFailureMessage[]
  readonly domainFailures: readonly ValidationFailureMessage[]
}

interface StepValidation {
  readonly fieldFailuresByBlock: ReadonlyMap<string, readonly ValidationFailureMessage[]>
  readonly fieldFailures: readonly ValidationFailureMessage[]
  readonly domainFailures: readonly ValidationFailureMessage[]
}

// The step root sits above the blocks and selects a distinct inspector.
type BlockSelection = string | 'step'

type BlockTab = 'props' | 'validation'

// --- Value helpers ---

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isExpandable(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  return isPlainObject(value) && Object.keys(value).length > 0
}

interface ChildEntry {
  readonly label: string
  readonly value: unknown
  readonly isIndex: boolean
}

function childEntries(value: unknown): readonly ChildEntry[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({ label: String(index), value: item, isIndex: true }))
  }

  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, entry]) => ({ label: key, value: entry, isIndex: false }))
  }

  return []
}

// --- Preview text ---

const PREVIEW_STRING_MAX = 30
const PREVIEW_OBJECT_MAX = 58
const BLOCK_PREVIEW_MAX = 34

function previewValueInline(value: unknown): string {
  if (typeof value === 'string') {
    const truncated = value.length > PREVIEW_STRING_MAX ? `${value.slice(0, PREVIEW_STRING_MAX)}…` : value

    return `"${truncated}"`
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`
  }

  if (isPlainObject(value)) {
    return '{…}'
  }

  if (value === undefined) {
    return 'undefined'
  }

  if (value === null) {
    return 'null'
  }

  return String(value)
}

function objectPreview(value: Record<string, unknown>): string {
  const parts = Object.entries(value).map(([key, entry]) => `${key}: ${previewValueInline(entry)}`)
  const assembled = parts.reduce<{ text: string; truncated: boolean }>(
    (accumulator, part) => {
      if (accumulator.truncated) {
        return accumulator
      }

      const next = accumulator.text === '' ? part : `${accumulator.text}, ${part}`

      if (next.length > PREVIEW_OBJECT_MAX) {
        return { text: accumulator.text, truncated: true }
      }

      return { text: next, truncated: false }
    },
    { text: '', truncated: false },
  )

  if (assembled.truncated) {
    const shown = assembled.text === '' ? parts[0].slice(0, 40) : assembled.text

    return `{${shown}, …}`
  }

  return `{${assembled.text}}`
}

function rowPreview(value: unknown): string {
  if (Array.isArray(value)) {
    return `Array(${value.length})`
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length === 0 ? '{}' : objectPreview(value)
  }

  return ''
}

function truncatePreview(text: string): string {
  return text.length > BLOCK_PREVIEW_MAX ? `${text.slice(0, BLOCK_PREVIEW_MAX)}…` : text
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function lastPathSegment(path: string): string {
  const segments = path.split('/').filter(Boolean)

  return segments[segments.length - 1] ?? path
}

// --- Unknown-narrowing readers for stepValidities ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const strings = value.filter((entry): entry is string => typeof entry === 'string')

  return strings.length === value.length ? strings : undefined
}

function readValidationFailure(value: unknown): ValidationFailureMessage | undefined {
  if (!isRecord(value) || typeof value.message !== 'string') {
    return undefined
  }

  const groups = readStringArray(value.groups)

  return {
    message: value.message,
    blockCode: typeof value.blockCode === 'string' ? value.blockCode : undefined,
    blockId: typeof value.blockId === 'string' ? value.blockId : undefined,
    groups,
    submissionOnly: value.submissionOnly === true,
  }
}

function readValidationFailures(value: unknown): readonly ValidationFailureMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(readValidationFailure).filter((failure): failure is ValidationFailureMessage => failure !== undefined)
}

function readStepValidity(value: unknown): StepValidityMessage | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  return {
    fieldFailures: readValidationFailures(value.fieldFailures),
    domainFailures: readValidationFailures(value.domainFailures),
  }
}

function collectUnits(units: readonly TraceUnitMessage[]): readonly TraceUnitMessage[] {
  return units.flatMap(unit => [unit, ...collectUnits(unit.children ?? [])])
}

function latestStepValidities(trace: TraceMessage): Record<string, StepValidityMessage> {
  const snapshots = trace.trace.phases
    .flatMap(phase => collectUnits(phase.units))
    .map(unit => unit.snapshot)
    .filter(snapshot => snapshot?.stepValidities !== undefined)

  const stepValidities = snapshots[snapshots.length - 1]?.stepValidities

  if (stepValidities === undefined) {
    return {}
  }

  return Object.entries(stepValidities).reduce<Record<string, StepValidityMessage>>((validities, [stepId, value]) => {
    const validity = readStepValidity(value)

    if (validity === undefined) {
      return validities
    }

    return { ...validities, [stepId]: validity }
  }, {})
}

// stepValidities is keyed by the SHORT step nodeId — the last `::` segment of the trace nodeId.
function currentStepKey(trace: TraceMessage): string {
  const segments = trace.nodeId.split('::')

  return segments[segments.length - 1]
}

function buildStepValidation(trace: TraceMessage): StepValidation {
  const validity = latestStepValidities(trace)[currentStepKey(trace)]
  const fieldFailures = validity?.fieldFailures ?? []
  const domainFailures = validity?.domainFailures ?? []
  const fieldFailuresByBlock = new Map<string, ValidationFailureMessage[]>()

  fieldFailures.forEach(failure => {
    if (failure.blockId === undefined) {
      return
    }

    const existing = fieldFailuresByBlock.get(failure.blockId) ?? []
    existing.push(failure)
    fieldFailuresByBlock.set(failure.blockId, existing)
  })

  return { fieldFailuresByBlock, fieldFailures, domainFailures }
}

// --- Block tree building ---

function isResolveBlock(unit: TraceUnitMessage): boolean {
  return unit.kind === 'resolve.block'
}

function blockTypeOf(unit: TraceUnitMessage): string | undefined {
  const fromFields = unit.fields?.blockType

  if (typeof fromFields === 'string') {
    return fromFields
  }

  const fromProperties = unit.properties?.blockType

  return typeof fromProperties === 'string' ? fromProperties : undefined
}

function isFieldBlock(unit: TraceUnitMessage): boolean {
  const blockType = blockTypeOf(unit)

  return blockType !== undefined && blockType.endsWith('.field')
}

// The nearest resolve.block descendants, without descending through a block's own subtree.
function collectChildBlocks(units: readonly TraceUnitMessage[]): readonly TraceUnitMessage[] {
  return units.flatMap(unit => (isResolveBlock(unit) ? [unit] : collectChildBlocks(unit.children ?? [])))
}

function buildBlockTree(trace: TraceMessage): readonly BlockNode[] {
  const seen = new Set<string>()

  function build(unit: TraceUnitMessage): BlockNode | undefined {
    const nodeId = unit.nodeId ?? ''

    if (seen.has(nodeId)) {
      return undefined
    }

    seen.add(nodeId)

    const children = collectChildBlocks(unit.children ?? [])
      .map(build)
      .filter((node): node is BlockNode => node !== undefined)

    return {
      nodeId,
      variant: unit.variant ?? unit.nodeId ?? 'block',
      isField: isFieldBlock(unit),
      properties: unit.properties ?? {},
      children,
    }
  }

  return trace.trace.phases
    .flatMap(phase => collectChildBlocks(phase.units))
    .map(build)
    .filter((node): node is BlockNode => node !== undefined)
}

function flattenBlocks(nodes: readonly BlockNode[]): readonly BlockNode[] {
  return nodes.flatMap(node => [node, ...flattenBlocks(node.children)])
}

// --- Block preview and chips ---

function blockPreview(node: BlockNode): string {
  const properties = node.properties

  if (node.variant === 'html') {
    const tag = typeof properties.tag === 'string' ? properties.tag : ''
    const content = typeof properties.content === 'string' ? stripHtml(properties.content) : ''

    return truncatePreview(`<${tag}> "${content}"`)
  }

  if (node.isField && typeof properties.code === 'string') {
    return truncatePreview(`code: ${properties.code}`)
  }

  if (typeof properties.text === 'string') {
    return truncatePreview(`"${properties.text}"`)
  }

  if (node.variant === 'collection-block' && Array.isArray(properties.collection)) {
    return `${properties.collection.length} items`
  }

  return ''
}

function instanceIndex(nodeId: string): string | undefined {
  if (!nodeId.startsWith('compiled:template:')) {
    return undefined
  }

  const match = nodeId.match(/:(\d+)$/)

  return match !== null ? `:${match[1]}` : undefined
}

// --- Only-invalid filtering ---

function subtreeHasFailure(node: BlockNode, fieldFailuresByBlock: StepValidation['fieldFailuresByBlock']): boolean {
  if ((fieldFailuresByBlock.get(node.nodeId)?.length ?? 0) > 0) {
    return true
  }

  return node.children.some(child => subtreeHasFailure(child, fieldFailuresByBlock))
}

function filterInvalid(
  nodes: readonly BlockNode[],
  fieldFailuresByBlock: StepValidation['fieldFailuresByBlock'],
): readonly BlockNode[] {
  return nodes
    .filter(node => subtreeHasFailure(node, fieldFailuresByBlock))
    .map(node => ({ ...node, children: filterInvalid(node.children, fieldFailuresByBlock) }))
}

// --- Props tree ---

interface BlockReference {
  readonly id: string
  readonly variant: string
  readonly blockType: string
  readonly properties: Record<string, unknown>
}

function isBlockReference(value: unknown): value is BlockReference {
  if (!isPlainObject(value)) {
    return false
  }

  return typeof value.id === 'string' && typeof value.variant === 'string' && typeof value.blockType === 'string'
}

interface PropContext {
  readonly knownNodeIds: ReadonlySet<string>
  readonly onSelectBlock: (nodeId: string) => void
}

function BlockRefChip({ blockRef, context }: { readonly blockRef: BlockReference; readonly context: PropContext }) {
  const active = context.knownNodeIds.has(blockRef.id)

  const handleClick = () => {
    if (active) {
      context.onSelectBlock(blockRef.id)
    }
  }

  return (
    <button
      type="button"
      class={`block-ref${active ? '' : ' block-ref--inactive'}`}
      onClick={active ? handleClick : undefined}
      onMouseEnter={active ? () => highlightBlock(blockRef.id, blockRef.variant) : undefined}
      onMouseLeave={active ? clearBlockHighlight : undefined}
      title={blockRef.id}
    >
      {blockRef.variant}
    </button>
  )
}

function PropLeaf({ value }: { readonly value: unknown }) {
  if (value === undefined) {
    return <span class="blocks-view__prop-value property-value--null">undefined</span>
  }

  if (value === null) {
    return <span class="blocks-view__prop-value property-value--null">null</span>
  }

  if (typeof value === 'string') {
    return <span class="blocks-view__prop-value property-value--string">&quot;{value}&quot;</span>
  }

  if (typeof value === 'number') {
    return <span class="blocks-view__prop-value property-value--number">{value}</span>
  }

  if (typeof value === 'boolean') {
    return <span class="blocks-view__prop-value property-value--boolean">{String(value)}</span>
  }

  return <span class="blocks-view__prop-value">{String(value)}</span>
}

function PropRow({
  label,
  value,
  isIndex,
  context,
}: {
  readonly label: string
  readonly value: unknown
  readonly isIndex: boolean
  readonly context: PropContext
}) {
  const [expanded, setExpanded] = useState(false)
  const keyClass = `blocks-view__prop-key${isIndex ? ' blocks-view__prop-key--index' : ''}`

  // A block reference renders as a clickable stand-in chip, never as its raw internals.
  if (isBlockReference(value)) {
    return (
      <div class="blocks-view__prop-row">
        <span class="blocks-view__prop-caret" />
        <span class={keyClass}>{label}</span>
        <span class="blocks-view__prop-sep">:</span>
        <BlockRefChip blockRef={value} context={context} />
      </div>
    )
  }

  // An array of block references previews as its variants and expands to a chip per item.
  if (Array.isArray(value) && value.length > 0 && value.every(isBlockReference)) {
    return (
      <Fragment>
        <div class="blocks-view__prop-row" onClick={() => setExpanded(previous => !previous)}>
          <span class="blocks-view__prop-caret">{expanded ? '▾' : '▸'}</span>
          <span class={keyClass}>{label}</span>
          <span class="blocks-view__prop-sep">:</span>
          <span class="blocks-view__prop-preview">{`[${value.map(item => item.variant).join(', ')}]`}</span>
        </div>
        {expanded && (
          <div class="blocks-view__prop-children">
            {value.map((item, index) => (
              <PropRow key={index} label={String(index)} value={item} isIndex context={context} />
            ))}
          </div>
        )}
      </Fragment>
    )
  }

  const expandable = isExpandable(value)
  const isContainer = Array.isArray(value) || isPlainObject(value)

  return (
    <Fragment>
      <div class="blocks-view__prop-row" onClick={expandable ? () => setExpanded(previous => !previous) : undefined}>
        <span class="blocks-view__prop-caret">{expandable ? (expanded ? '▾' : '▸') : ''}</span>
        <span class={keyClass}>{label}</span>
        <span class="blocks-view__prop-sep">:</span>
        {isContainer ? <span class="blocks-view__prop-preview">{rowPreview(value)}</span> : <PropLeaf value={value} />}
      </div>
      {expandable && expanded && (
        <div class="blocks-view__prop-children">
          {childEntries(value).map(entry => (
            <PropRow key={entry.label} label={entry.label} value={entry.value} isIndex={entry.isIndex} context={context} />
          ))}
        </div>
      )}
    </Fragment>
  )
}

function PropsTree({ properties, context }: { readonly properties: Record<string, unknown>; readonly context: PropContext }) {
  // blockType is surfaced as the field chip, so it would be redundant here.
  const keys = Object.keys(properties).filter(key => key !== 'blockType')

  if (keys.length === 0) {
    return <div class="blocks-view__empty-note">No props</div>
  }

  return (
    <div class="blocks-view__props">
      {keys.map(key => (
        <PropRow key={key} label={key} value={properties[key]} isIndex={false} context={context} />
      ))}
    </div>
  )
}

// --- Failure cards ---

function FailureCard({ failure, tone }: { readonly failure: ValidationFailureMessage; readonly tone: 'error' | 'warning' }) {
  return (
    <div class={`blocks-view__fail-card blocks-view__fail-card--${tone}`}>
      <div class="blocks-view__fail-head">
        <span class={`blocks-view__fail-dot blocks-view__fail-dot--${tone}`} />
        <span class="blocks-view__fail-message">{failure.message}</span>
      </div>
      <div class="blocks-view__fail-meta">
        {tone === 'warning' ? (
          <span class="blocks-view__chip blocks-view__chip--warning">domain</span>
        ) : failure.submissionOnly ? (
          <span class="blocks-view__chip blocks-view__chip--muted">on submit</span>
        ) : (
          <span class="blocks-view__chip blocks-view__chip--error">blocking</span>
        )}
        {(failure.groups ?? []).map(group => (
          <span key={group} class="blocks-view__chip blocks-view__chip--muted">{group}</span>
        ))}
      </div>
    </div>
  )
}

function FailureCards({
  failures,
  tone,
  emptyNote,
}: {
  readonly failures: readonly ValidationFailureMessage[]
  readonly tone: 'error' | 'warning'
  readonly emptyNote: string
}) {
  if (failures.length === 0) {
    return <div class="blocks-view__empty-note">{emptyNote}</div>
  }

  return (
    <div class="blocks-view__cards">
      {failures.map((failure, index) => (
        <FailureCard key={index} failure={failure} tone={tone} />
      ))}
    </div>
  )
}

// --- Tree pane ---

function StepRootRow({
  title,
  routeTemplatePath,
  domainFailureCount,
  selected,
  onSelect,
}: {
  readonly title: string
  readonly routeTemplatePath: string
  readonly domainFailureCount: number
  readonly selected: boolean
  readonly onSelect: () => void
}) {
  return (
    <div class={`blocks-view__row${selected ? ' blocks-view__row--selected' : ''}`} onClick={onSelect}>
      <span class="blocks-view__caret" />
      <span class="blocks-view__step-title">{title}</span>
      <span class="blocks-view__preview">{lastPathSegment(routeTemplatePath)}</span>
      <span class="blocks-view__row-chips">
        {domainFailureCount > 0 && (
          <span class="blocks-view__chip blocks-view__chip--warning">{domainFailureCount} domain</span>
        )}
      </span>
    </div>
  )
}

function BlockRow({
  node,
  depth,
  selectedNodeId,
  fieldFailuresByBlock,
  onSelect,
}: {
  readonly node: BlockNode
  readonly depth: number
  readonly selectedNodeId: string | undefined
  readonly fieldFailuresByBlock: StepValidation['fieldFailuresByBlock']
  readonly onSelect: (nodeId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const failureCount = fieldFailuresByBlock.get(node.nodeId)?.length ?? 0
  const preview = blockPreview(node)
  const instance = instanceIndex(node.nodeId)
  const selected = node.nodeId === selectedNodeId

  return (
    <Fragment>
      <div
        class={`blocks-view__row${selected ? ' blocks-view__row--selected' : ''}`}
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => onSelect(node.nodeId)}
        onMouseEnter={() => highlightBlock(node.nodeId, node.variant)}
        onMouseLeave={clearBlockHighlight}
      >
        {hasChildren ? (
          <button
            type="button"
            class="blocks-view__caret"
            aria-label={expanded ? `Collapse ${node.variant}` : `Expand ${node.variant}`}
            onClick={event => {
              event.stopPropagation()
              setExpanded(previous => !previous)
            }}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span class="blocks-view__caret" />
        )}
        <span class="blocks-view__variant">{node.variant}</span>
        {preview && <span class="blocks-view__preview">{preview}</span>}
        <span class="blocks-view__row-chips">
          {node.isField && <span class="blocks-view__chip blocks-view__chip--accent">field</span>}
          {failureCount > 0 && <span class="blocks-view__chip blocks-view__chip--error">{failureCount} ✕</span>}
          {instance !== undefined && <span class="blocks-view__chip blocks-view__chip--muted">{instance}</span>}
        </span>
      </div>
      {hasChildren && expanded && node.children.map(child => (
        <BlockRow
          key={child.nodeId}
          node={child}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          fieldFailuresByBlock={fieldFailuresByBlock}
          onSelect={onSelect}
        />
      ))}
    </Fragment>
  )
}

// --- Inspector ---

function BlockInspector({
  node,
  failures,
  tab,
  onTab,
  context,
}: {
  readonly node: BlockNode
  readonly failures: readonly ValidationFailureMessage[]
  readonly tab: BlockTab
  readonly onTab: (tab: BlockTab) => void
  readonly context: PropContext
}) {
  const code = typeof node.properties.code === 'string' ? node.properties.code : undefined

  return (
    <div class="blocks-view__inspector">
      <div class="blocks-view__inspector-title">
        <span class="blocks-view__inspector-variant">{node.variant}</span>
        {node.isField && <span class="blocks-view__chip blocks-view__chip--accent">field</span>}
      </div>
      <div class="blocks-view__inspector-sub">
        {node.nodeId}
        {code !== undefined ? ` · code ${code}` : ''}
      </div>
      <div class="blocks-view__subtabs">
        <button
          class={`blocks-view__subtab${tab === 'props' ? ' blocks-view__subtab--active' : ''}`}
          onClick={() => onTab('props')}
        >
          Props
        </button>
        <button
          class={`blocks-view__subtab${tab === 'validation' ? ' blocks-view__subtab--active' : ''}`}
          onClick={() => onTab('validation')}
        >
          Validation
          {failures.length > 0 && <span class="blocks-view__count-pill">{failures.length}</span>}
        </button>
      </div>
      {tab === 'props' ? (
        <PropsTree properties={node.properties} context={context} />
      ) : (
        <FailureCards failures={failures} tone="error" emptyNote="No failures on this block" />
      )}
    </div>
  )
}

function StepInspector({
  title,
  routeTemplatePath,
  domainFailures,
}: {
  readonly title: string
  readonly routeTemplatePath: string
  readonly domainFailures: readonly ValidationFailureMessage[]
}) {
  return (
    <div class="blocks-view__inspector">
      <div class="blocks-view__inspector-title">
        <span class="blocks-view__inspector-variant">{title}</span>
      </div>
      <div class="blocks-view__inspector-sub">{routeTemplatePath}</div>
      <FailureCards failures={domainFailures} tone="warning" emptyNote="No step-level failures" />
    </div>
  )
}

// --- Container ---

function resolveSelection(
  selection: BlockSelection | undefined,
  flatBlocks: readonly BlockNode[],
  fallback: BlockSelection,
): BlockSelection {
  if (selection === 'step') {
    return 'step'
  }

  if (typeof selection === 'string' && flatBlocks.some(node => node.nodeId === selection)) {
    return selection
  }

  return fallback
}

export default function BlocksView({ trace }: BlocksViewProps) {
  const [selection, setSelection] = useState<BlockSelection | undefined>(undefined)
  const [tab, setTab] = useState<BlockTab>('props')
  const [onlyInvalid, setOnlyInvalid] = useState(false)

  useEffect(() => {
    setSelection(undefined)
    setTab('props')
  }, [trace])

  // Drop any page highlight when the trace changes or the view unmounts (e.g. tab switch).
  useEffect(() => () => clearBlockHighlight(), [trace])

  const blocks = useMemo(() => (trace ? buildBlockTree(trace) : []), [trace])
  const validation = useMemo<StepValidation>(
    () => (trace ? buildStepValidation(trace) : { fieldFailuresByBlock: new Map(), fieldFailures: [], domainFailures: [] }),
    [trace],
  )
  const flatBlocks = useMemo(() => flattenBlocks(blocks), [blocks])

  if (!trace) {
    return <div class="empty-state">Select a trace to view details</div>
  }

  const { fieldFailuresByBlock, fieldFailures, domainFailures } = validation
  const firstFailingBlock = flatBlocks.find(node => (fieldFailuresByBlock.get(node.nodeId)?.length ?? 0) > 0)
  const defaultSelection: BlockSelection = firstFailingBlock !== undefined ? firstFailingBlock.nodeId : 'step'
  const effectiveSelection = resolveSelection(selection, flatBlocks, defaultSelection)
  const selectedNode =
    effectiveSelection === 'step' ? undefined : flatBlocks.find(node => node.nodeId === effectiveSelection)

  const stepTitle = trace.route.stepTitle ?? 'Step'
  const failureCount = fieldFailures.length + domainFailures.length
  const fieldCount = flatBlocks.filter(node => node.isField).length
  const displayedBlocks = onlyInvalid ? filterInvalid(blocks, fieldFailuresByBlock) : blocks
  const propContext: PropContext = {
    knownNodeIds: new Set(flatBlocks.map(node => node.nodeId)),
    onSelectBlock: setSelection,
  }

  return (
    <div class="blocks-view">
      <div class="blocks-view__toolbar">
        <span>
          <b>{flatBlocks.length}</b> blocks · <b>{fieldCount}</b> fields ·{' '}
          <span class={`blocks-view__count${failureCount > 0 ? ' blocks-view__count--error' : ''}`}>
            <b>{failureCount}</b> failures
          </span>
        </span>
        <span class="blocks-view__spacer" />
        <label class="blocks-view__checkbox">
          <input type="checkbox" checked={onlyInvalid} onChange={() => setOnlyInvalid(previous => !previous)} />
          Only invalid
        </label>
      </div>
      <div class="blocks-view__split">
        <div class="blocks-view__tree">
          <StepRootRow
            title={stepTitle}
            routeTemplatePath={trace.route.routeTemplatePath}
            domainFailureCount={domainFailures.length}
            selected={effectiveSelection === 'step'}
            onSelect={() => setSelection('step')}
          />
          {onlyInvalid && displayedBlocks.length === 0 ? (
            <div class="blocks-view__empty-note">No validation failures on this step</div>
          ) : (
            displayedBlocks.map(node => (
              <BlockRow
                key={node.nodeId}
                node={node}
                depth={0}
                selectedNodeId={selectedNode?.nodeId}
                fieldFailuresByBlock={fieldFailuresByBlock}
                onSelect={setSelection}
              />
            ))
          )}
        </div>
        {selectedNode !== undefined ? (
          <BlockInspector
            node={selectedNode}
            failures={fieldFailuresByBlock.get(selectedNode.nodeId) ?? []}
            tab={tab}
            onTab={setTab}
            context={propContext}
          />
        ) : (
          <StepInspector title={stepTitle} routeTemplatePath={trace.route.routeTemplatePath} domainFailures={domainFailures} />
        )}
      </div>
    </div>
  )
}
