import { Fragment, h } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { TraceMessage, TraceRequestMessage, TraceSnapshotMessage, TraceUnitMessage } from '../hooks/useConnection'

// --- Types ---

interface StateViewProps {
  readonly trace: TraceMessage | undefined
}

interface PhaseSnapshot {
  readonly phase: string
  readonly answers: Record<string, unknown>
  readonly data: Record<string, unknown>
}

interface ChangeSet {
  readonly added: ReadonlySet<string>
  readonly removed: ReadonlySet<string>
  readonly changed: ReadonlySet<string>
}

interface PhaseChange {
  readonly answers: ChangeSet
  readonly data: ChangeSet
}

// Answer values arrive as `{ current, mutations }` wrappers on the wire; entries that don't match
// the shape are rendered as plain values.
interface AnswerMutation {
  readonly value?: unknown
  readonly source: string
}

interface AnswerEntry {
  readonly current?: unknown
  readonly mutations?: readonly AnswerMutation[]
}

interface TreeChip {
  readonly text: string
  readonly kind: string
}

type SubTab = 'answers' | 'data'

type RequestTab = 'post' | 'query' | 'params' | 'state' | 'headers' | 'cookies' | 'session'

// The request item is pinned above the phase items and selects a distinct inspector.
type PhaseSelection = number | 'request'

// --- Value helpers ---

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAnswerEntry(value: unknown): value is AnswerEntry {
  if (!isPlainObject(value)) {
    return false
  }

  const mutations = value.mutations
  const hasValidMutations =
    mutations === undefined ||
    (Array.isArray(mutations) && mutations.every(mutation => isPlainObject(mutation) && typeof mutation.source === 'string'))

  if (!hasValidMutations) {
    return false
  }

  return 'current' in value || Array.isArray(mutations)
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

// --- Snapshots and change sets ---

function findSnapshot(units: readonly TraceUnitMessage[]): TraceSnapshotMessage | undefined {
  const direct = units.find(unit => unit.snapshot !== undefined)?.snapshot

  if (direct !== undefined) {
    return direct
  }

  return units.map(unit => findSnapshot(unit.children ?? [])).find(snapshot => snapshot !== undefined)
}

function buildPhaseSnapshots(trace: TraceMessage): readonly PhaseSnapshot[] {
  return trace.trace.phases
    .map(phase => ({ phase: phase.phase, snapshot: findSnapshot(phase.units) }))
    .filter((entry): entry is { phase: string; snapshot: TraceSnapshotMessage } => entry.snapshot !== undefined)
    .map(({ phase, snapshot }) => ({ phase, answers: snapshot.answers ?? {}, data: snapshot.data ?? {} }))
}

function diffKeys(previous: Record<string, unknown>, current: Record<string, unknown>): ChangeSet {
  const added = new Set<string>()
  const removed = new Set<string>()
  const changed = new Set<string>()

  Object.keys(current).forEach(key => {
    if (!(key in previous)) {
      added.add(key)

      return
    }

    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      changed.add(key)
    }
  })

  Object.keys(previous).forEach(key => {
    if (!(key in current)) {
      removed.add(key)
    }
  })

  return { added, removed, changed }
}

const EMPTY_SNAPSHOT: PhaseSnapshot = { phase: '', answers: {}, data: {} }

function buildChanges(phaseSnapshots: readonly PhaseSnapshot[]): readonly PhaseChange[] {
  return phaseSnapshots.map((snapshot, index) => {
    const previous = index > 0 ? phaseSnapshots[index - 1] : EMPTY_SNAPSHOT

    return {
      answers: diffKeys(previous.answers, snapshot.answers),
      data: diffKeys(previous.data, snapshot.data),
    }
  })
}

function wasChangedAt(change: ChangeSet, key: string): boolean {
  return change.added.has(key) || change.changed.has(key)
}

function hasAnyChange(change: ChangeSet): boolean {
  return change.added.size + change.removed.size + change.changed.size > 0
}

// The phase name that most recently added or changed a data root at or before the selected phase.
function lastWriterPhase(
  key: string,
  changes: readonly PhaseChange[],
  phaseSnapshots: readonly PhaseSnapshot[],
  selectedIndex: number,
): string | undefined {
  const writerIndex = Array.from({ length: selectedIndex + 1 }, (unused, index) => selectedIndex - index).find(index =>
    wasChangedAt(changes[index].data, key),
  )

  return writerIndex !== undefined ? phaseSnapshots[writerIndex].phase : undefined
}

// --- Chips ---

function answerSourceKind(source: string): string {
  if (source === 'access' || source === 'submission' || source === 'default') {
    return source
  }

  return 'other'
}

function lastMutationSource(entry: AnswerEntry): string | undefined {
  const mutations = entry.mutations

  if (mutations === undefined || mutations.length === 0) {
    return undefined
  }

  return mutations[mutations.length - 1].source
}

// --- Rail badges ---

interface RailBadge {
  readonly kind: string
  readonly text: string
}

function buildBadges(change: PhaseChange): readonly RailBadge[] {
  const badges: RailBadge[] = []

  if (change.answers.added.size > 0) {
    badges.push({ kind: 'add', text: `+${change.answers.added.size}` })
  }

  if (change.answers.removed.size > 0) {
    badges.push({ kind: 'del', text: `−${change.answers.removed.size}` })
  }

  if (change.answers.changed.size > 0) {
    badges.push({ kind: 'chg', text: `~${change.answers.changed.size}` })
  }

  if (hasAnyChange(change.data)) {
    badges.push({ kind: 'data', text: 'data' })
  }

  if (badges.length === 0) {
    return [{ kind: 'none', text: '·' }]
  }

  return badges
}

// --- Tree ---

function LeafValue({ value }: { readonly value: unknown }) {
  if (value === undefined) {
    return <span class="state-view__tree-value property-value--null">undefined</span>
  }

  if (value === null) {
    return <span class="state-view__tree-value property-value--null">null</span>
  }

  if (typeof value === 'string') {
    return <span class="state-view__tree-value property-value--string">&quot;{value}&quot;</span>
  }

  if (typeof value === 'number') {
    return <span class="state-view__tree-value property-value--number">{value}</span>
  }

  if (typeof value === 'boolean') {
    return <span class="state-view__tree-value property-value--boolean">{String(value)}</span>
  }

  return <span class="state-view__tree-value">{String(value)}</span>
}

function TreeRow({
  label,
  value,
  isIndex,
  chip,
  tinted,
}: {
  readonly label: string
  readonly value: unknown
  readonly isIndex: boolean
  readonly chip?: TreeChip
  readonly tinted?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const expandable = isExpandable(value)
  const isContainer = Array.isArray(value) || isPlainObject(value)
  const keyClass = `state-view__tree-key${isIndex ? ' state-view__tree-key--index' : ''}`

  return (
    <Fragment>
      <div
        class={`state-view__tree-row${tinted ? ' state-view__tree-row--new' : ''}`}
        onClick={expandable ? () => setExpanded(previous => !previous) : undefined}
      >
        <span class="state-view__tree-caret">{expandable ? (expanded ? '▼' : '▶') : ''}</span>
        <span class={keyClass}>{label}</span>
        <span class="state-view__tree-sep">:</span>
        {isContainer ? <span class="state-view__tree-preview">{rowPreview(value)}</span> : <LeafValue value={value} />}
        {chip !== undefined && (
          <span class={`state-view__chip state-view__chip--${chip.kind} state-view__tree-chip`}>{chip.text}</span>
        )}
      </div>
      {expandable && expanded && (
        <div class={`state-view__tree-children${tinted ? ' state-view__tree-children--new' : ''}`}>
          {childEntries(value).map(entry => (
            <TreeRow key={entry.label} label={entry.label} value={entry.value} isIndex={entry.isIndex} />
          ))}
        </div>
      )}
    </Fragment>
  )
}

// --- Rail ---

function PhaseRail({
  phaseSnapshots,
  changes,
  selectedIndex,
  hasRequest,
  isRequestSelected,
  onSelectPhase,
  onSelectRequest,
}: {
  readonly phaseSnapshots: readonly PhaseSnapshot[]
  readonly changes: readonly PhaseChange[]
  readonly selectedIndex: number
  readonly hasRequest: boolean
  readonly isRequestSelected: boolean
  readonly onSelectPhase: (index: number) => void
  readonly onSelectRequest: () => void
}) {
  return (
    <div class="state-view__rail">
      {hasRequest && (
        <Fragment>
          <div
            class={`state-view__rail-item${isRequestSelected ? ' state-view__rail-item--selected' : ''}`}
            onClick={onSelectRequest}
          >
            <span class="state-view__rail-name">request</span>
            <span class="state-view__rail-badges">
              <span class="state-view__badge state-view__badge--none">input</span>
            </span>
          </div>
          <div class="state-view__rail-divider" />
        </Fragment>
      )}
      {phaseSnapshots.map((snapshot, index) => (
        <div
          key={index}
          class={`state-view__rail-item${!isRequestSelected && index === selectedIndex ? ' state-view__rail-item--selected' : ''}`}
          onClick={() => onSelectPhase(index)}
        >
          <span class="state-view__rail-name">{snapshot.phase}</span>
          <span class="state-view__rail-badges">
            {buildBadges(changes[index]).map((badge, badgeIndex) => (
              <span key={badgeIndex} class={`state-view__badge state-view__badge--${badge.kind}`}>{badge.text}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

// --- Inspector ---

function subLine(answersWritten: number, answersCleared: number, dataLoaded: number): string {
  const parts: string[] = []

  if (answersWritten > 0) {
    parts.push(`${answersWritten} answer${answersWritten === 1 ? '' : 's'} written`)
  }

  if (answersCleared > 0) {
    parts.push(`${answersCleared} answer${answersCleared === 1 ? '' : 's'} cleared`)
  }

  if (dataLoaded > 0) {
    parts.push(`${dataLoaded} data root${dataLoaded === 1 ? '' : 's'} loaded`)
  }

  if (parts.length === 0) {
    return 'No changes at this phase'
  }

  return `${parts.join(' · ')} at this phase`
}

function AnswersTree({ snapshot, change }: { readonly snapshot: PhaseSnapshot; readonly change: PhaseChange }) {
  const keys = Object.keys(snapshot.answers)

  if (keys.length === 0) {
    return <div class="state-view__empty-note">No answers at this phase</div>
  }

  return (
    <div class="state-view__tree">
      {keys.map(key => {
        const raw = snapshot.answers[key]
        const entry = isAnswerEntry(raw) ? raw : undefined
        const value = entry !== undefined ? entry.current : raw
        const source = entry !== undefined ? lastMutationSource(entry) : undefined
        const chip = source !== undefined ? { text: source, kind: answerSourceKind(source) } : undefined

        return (
          <TreeRow key={key} label={key} value={value} isIndex={false} chip={chip} tinted={wasChangedAt(change.answers, key)} />
        )
      })}
    </div>
  )
}

function DataTree({
  snapshot,
  changes,
  phaseSnapshots,
  selectedIndex,
}: {
  readonly snapshot: PhaseSnapshot
  readonly changes: readonly PhaseChange[]
  readonly phaseSnapshots: readonly PhaseSnapshot[]
  readonly selectedIndex: number
}) {
  const keys = Object.keys(snapshot.data)

  if (keys.length === 0) {
    return <div class="state-view__empty-note">No data at this phase</div>
  }

  return (
    <div class="state-view__tree">
      {keys.map(key => {
        const writer = lastWriterPhase(key, changes, phaseSnapshots, selectedIndex)
        const chip = writer !== undefined ? { text: writer, kind: 'phase' } : undefined

        return (
          <TreeRow
            key={key}
            label={key}
            value={snapshot.data[key]}
            isIndex={false}
            chip={chip}
            tinted={wasChangedAt(changes[selectedIndex].data, key)}
          />
        )
      })}
    </div>
  )
}

function PhaseInspector({
  phaseSnapshots,
  changes,
  selectedIndex,
  subTab,
  onSubTab,
}: {
  readonly phaseSnapshots: readonly PhaseSnapshot[]
  readonly changes: readonly PhaseChange[]
  readonly selectedIndex: number
  readonly subTab: SubTab
  readonly onSubTab: (tab: SubTab) => void
}) {
  const snapshot = phaseSnapshots[selectedIndex]
  const change = changes[selectedIndex]
  const answersWritten = change.answers.added.size + change.answers.changed.size
  const answersCleared = change.answers.removed.size
  const dataLoaded = change.data.added.size + change.data.changed.size

  return (
    <div class="state-view__inspector">
      <div class="state-view__inspector-title">
        Snapshot after <span class="state-view__mono">{snapshot.phase}</span>
      </div>
      <div class="state-view__inspector-sub">{subLine(answersWritten, answersCleared, dataLoaded)}</div>
      <div class="state-view__subtabs">
        <button
          class={`state-view__subtab${subTab === 'answers' ? ' state-view__subtab--active' : ''}`}
          onClick={() => onSubTab('answers')}
        >
          Answers
        </button>
        <button
          class={`state-view__subtab${subTab === 'data' ? ' state-view__subtab--active' : ''}`}
          onClick={() => onSubTab('data')}
        >
          Data
        </button>
      </div>
      {subTab === 'answers' ? (
        <AnswersTree snapshot={snapshot} change={change} />
      ) : (
        <DataTree snapshot={snapshot} changes={changes} phaseSnapshots={phaseSnapshots} selectedIndex={selectedIndex} />
      )}
      <div class="state-view__note">
        {subTab === 'answers'
          ? 'Green rows were written at this phase. Chips show each key’s latest write source.'
          : 'Green rows loaded at this phase; the border marks the subtree that arrived as part of that write.'}
      </div>
    </div>
  )
}

// --- Request inspector ---

function RecordTree({ record, emptyNote }: { readonly record: Record<string, unknown>; readonly emptyNote: string }) {
  const keys = Object.keys(record)

  if (keys.length === 0) {
    return <div class="state-view__empty-note">{emptyNote}</div>
  }

  return (
    <div class="state-view__tree">
      {keys.map(key => (
        <TreeRow key={key} label={key} value={record[key]} isIndex={false} />
      ))}
    </div>
  )
}

const REQUEST_TABS: readonly { readonly id: RequestTab; readonly label: string; readonly emptyNote: string }[] = [
  { id: 'post', label: 'Post', emptyNote: 'No POST body' },
  { id: 'query', label: 'Query', emptyNote: 'No query parameters' },
  { id: 'params', label: 'Params', emptyNote: 'No route params' },
  { id: 'state', label: 'State', emptyNote: 'No request state' },
  { id: 'headers', label: 'Headers', emptyNote: 'No headers' },
  { id: 'cookies', label: 'Cookies', emptyNote: 'No cookies' },
  { id: 'session', label: 'Session', emptyNote: 'No session state' },
]

function requestRecord(request: TraceRequestMessage, tab: RequestTab): Record<string, unknown> {
  if (tab === 'post') {
    return request.post
  }

  if (tab === 'query') {
    return request.query
  }

  if (tab === 'params') {
    return request.params
  }

  if (tab === 'state') {
    return request.state
  }

  // Headers, cookies and session were added after the first request-inputs release; a buffered
  // trace from a not-yet-restarted server won't carry them, so fall back to an empty record.
  if (tab === 'headers') {
    return request.headers ?? {}
  }

  if (tab === 'cookies') {
    return request.cookies ?? {}
  }

  return request.session ?? {}
}

function RequestInspector({
  request,
  tab,
  onTab,
}: {
  readonly request: TraceRequestMessage
  readonly tab: RequestTab
  readonly onTab: (tab: RequestTab) => void
}) {
  const active = REQUEST_TABS.find(entry => entry.id === tab) ?? REQUEST_TABS[0]

  return (
    <div class="state-view__inspector">
      <div class="state-view__inspector-title">Request input</div>
      <div class="state-view__inspector-sub">Values the adapter passed to this evaluation</div>
      <div class="state-view__subtabs">
        {REQUEST_TABS.map(entry => (
          <button
            key={entry.id}
            class={`state-view__subtab${tab === entry.id ? ' state-view__subtab--active' : ''}`}
            onClick={() => onTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <RecordTree record={requestRecord(request, tab)} emptyNote={active.emptyNote} />
    </div>
  )
}

// --- Container ---

export default function StateView({ trace }: StateViewProps) {
  const [selection, setSelection] = useState<PhaseSelection | undefined>(undefined)
  const [subTab, setSubTab] = useState<SubTab>('answers')
  const [requestTab, setRequestTab] = useState<RequestTab>('post')

  // A new trace re-defaults selection to its final phase (landing view is the final state).
  useEffect(() => {
    setSelection(undefined)
  }, [trace])

  const phaseSnapshots = useMemo(() => (trace ? buildPhaseSnapshots(trace) : []), [trace])
  const changes = useMemo(() => buildChanges(phaseSnapshots), [phaseSnapshots])

  if (!trace) {
    return <div class="empty-state">Select a trace to view details</div>
  }

  if (phaseSnapshots.length === 0) {
    return <div class="empty-state">No state snapshots in this trace</div>
  }

  const request = trace.request
  const isRequestSelected = selection === 'request' && request !== undefined
  const selectedIndex =
    typeof selection === 'number' && selection < phaseSnapshots.length ? selection : phaseSnapshots.length - 1
  const selected = phaseSnapshots[selectedIndex]
  const answerCount = Object.keys(selected.answers).length
  const dataCount = Object.keys(selected.data).length

  return (
    <div class="state-view">
      <div class="state-view__toolbar">
        <span>
          <b>{trace.method}</b> <span class="state-view__mono">{trace.pathname}</span>
        </span>
        <span class="state-view__spacer" />
        {isRequestSelected && request !== undefined ? (
          <span>
            <b>{Object.keys(request.post).length}</b> post · <b>{Object.keys(request.query).length}</b> query ·{' '}
            <b>{Object.keys(request.params).length}</b> params · <b>{Object.keys(request.state).length}</b> state ·{' '}
            <b>{Object.keys(request.headers ?? {}).length}</b> headers · <b>{Object.keys(request.cookies ?? {}).length}</b> cookies ·{' '}
            <b>{Object.keys(request.session ?? {}).length}</b> session keys
          </span>
        ) : (
          <span>
            <b>{answerCount}</b> answers · <b>{dataCount}</b> data roots at selected phase
          </span>
        )}
      </div>
      <div class="state-view__split">
        <PhaseRail
          phaseSnapshots={phaseSnapshots}
          changes={changes}
          selectedIndex={selectedIndex}
          hasRequest={request !== undefined}
          isRequestSelected={isRequestSelected}
          onSelectPhase={setSelection}
          onSelectRequest={() => setSelection('request')}
        />
        {isRequestSelected && request !== undefined ? (
          <RequestInspector request={request} tab={requestTab} onTab={setRequestTab} />
        ) : (
          <PhaseInspector
            phaseSnapshots={phaseSnapshots}
            changes={changes}
            selectedIndex={selectedIndex}
            subTab={subTab}
            onSubTab={setSubTab}
          />
        )}
      </div>
    </div>
  )
}
