import { Fragment, h } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import type {
  TraceMessage,
  TraceReachabilityMessage,
  TraceReachabilityStepMessage,
  TraceUnitMessage,
} from '../hooks/useConnection'

// --- Constants ---

const NODE_WIDTH = 170
const NODE_HEIGHT = 40
const COLUMN_PITCH = 226
const ROW_PITCH = 52
const STAGE_PADDING_X = 8
// Backward / same-rank edges elbow 24px past the source's right edge and the target's left edge,
// plus a 7px arrowhead — a wider horizontal margin keeps those excursions inside the viewBox.
const STAGE_PADDING_X_LOOPED = 40
const STAGE_PADDING_Y = 14

// --- Types ---

interface ReachabilityViewProps {
  readonly trace: TraceMessage | undefined
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

interface StepValidationSummary {
  readonly blockingFailures: readonly ValidationFailureMessage[]
  readonly informationalFailures: readonly ValidationFailureMessage[]
}

type StepStatus = 'reachable' | 'unreachable' | 'invalid'

interface GraphNode {
  readonly step: TraceReachabilityStepMessage
  readonly rank: number
  readonly x: number
  readonly y: number
}

type GraphEdgeKind = 'evaluated' | 'current' | 'rejected'

interface GraphEdge {
  readonly key: string
  readonly from: GraphNode
  readonly to: GraphNode
  readonly kind: GraphEdgeKind
  readonly faint: boolean
}

interface GraphLayout {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly width: number
  readonly height: number
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

// --- Step helpers ---

function validationSummary(
  step: TraceReachabilityStepMessage,
  stepValidities: Record<string, StepValidityMessage>,
): StepValidationSummary {
  const validity = stepValidities[step.stepId]
  const failures = [...(validity?.fieldFailures ?? []), ...(validity?.domainFailures ?? [])]
  const blockingFailures = failures.filter(
    failure => !failure.submissionOnly && (failure.groups === undefined || failure.groups.includes('default')),
  )
  const informationalFailures = failures.filter(failure => !blockingFailures.includes(failure))

  return { blockingFailures, informationalFailures }
}

function blockingFailuresLabel(count: number): string {
  return `${count} blocking ${count === 1 ? 'failure' : 'failures'}`
}

function statusFor(step: TraceReachabilityStepMessage): StepStatus {
  if (!step.isValid) {
    return 'invalid'
  }

  if (step.isReachable) {
    return 'reachable'
  }

  return 'unreachable'
}

function displayStepName(step: TraceReachabilityStepMessage): string {
  if (step.code) {
    return step.code
  }

  return lastPathSegment(step.routeTemplatePath)
}

function displayCodeForPath(path: string, stepLookup: Map<string, TraceReachabilityStepMessage>): string {
  const step = stepLookup.get(path)

  if (step !== undefined) {
    return displayStepName(step)
  }

  return lastPathSegment(path)
}

function lastPathSegment(path: string): string {
  const segments = path.split('/').filter(Boolean)

  return segments[segments.length - 1] ?? path
}

function buildStepLookup(reachability: TraceReachabilityMessage): Map<string, TraceReachabilityStepMessage> {
  return new Map(reachability.steps.map(step => [step.routeTemplatePath, step]))
}

// Declared forward targets that were not evaluated, resolved to the steps they point at.
function rejectedTargetSteps(
  step: TraceReachabilityStepMessage,
  stepLookup: Map<string, TraceReachabilityStepMessage>,
): readonly TraceReachabilityStepMessage[] {
  const declaredPaths = step.declaredForwardRouteTemplatePaths ?? step.forwardRouteTemplatePaths
  const evaluatedPaths = new Set(step.forwardRouteTemplatePaths)

  return declaredPaths
    .filter(path => !evaluatedPaths.has(path))
    .map(path => stepLookup.get(path))
    .filter((target): target is TraceReachabilityStepMessage => target !== undefined)
}

function collectRejectedTargetPaths(reachability: TraceReachabilityMessage): Set<string> {
  const paths = new Set<string>()

  reachability.steps.forEach(step => {
    const declaredPaths = step.declaredForwardRouteTemplatePaths ?? step.forwardRouteTemplatePaths
    const evaluatedPaths = new Set(step.forwardRouteTemplatePaths)

    declaredPaths.filter(path => !evaluatedPaths.has(path)).forEach(path => paths.add(path))
  })

  return paths
}

function nodeMeta(
  step: TraceReachabilityStepMessage,
  reachability: TraceReachabilityMessage,
  blockingCount: number,
  isRejectedTarget: boolean,
): string {
  const status = statusFor(step)
  const declaredCount = (step.declaredForwardRouteTemplatePaths ?? step.forwardRouteTemplatePaths).length
  const evaluatedCount = step.forwardRouteTemplatePaths.length
  const parts: (string | undefined)[] = [
    step.isEntryPoint ? 'entry' : undefined,
    reachability.currentStepId === step.stepId ? 'current' : undefined,
    reachability.frontierRouteTemplatePath === step.routeTemplatePath ? 'frontier' : undefined,
  ]

  if (status === 'invalid') {
    parts.push(blockingFailuresLabel(blockingCount))
  } else if (status === 'reachable' && declaredCount > evaluatedCount) {
    parts.push(`${evaluatedCount} of ${declaredCount} branches taken`)
  } else if (status === 'unreachable') {
    parts.push(isRejectedTarget ? 'branch not taken' : 'unreachable')
  }

  return parts.filter((part): part is string => part !== undefined).join(' · ')
}

// --- Graph layout ---

function buildPredecessorLookup(reachability: TraceReachabilityMessage): Map<string, readonly string[]> {
  const predecessors = new Map<string, string[]>()

  reachability.steps.forEach(step => predecessors.set(step.routeTemplatePath, [...step.predecessorRouteTemplatePaths]))
  reachability.steps.forEach(step => {
    const declaredPaths = step.declaredForwardRouteTemplatePaths ?? step.forwardRouteTemplatePaths

    declaredPaths.forEach(path => {
      const existing = predecessors.get(path) ?? []

      if (!existing.includes(step.routeTemplatePath)) {
        predecessors.set(path, [...existing, step.routeTemplatePath])
      }
    })
  })

  return predecessors
}

function rankStep(
  step: TraceReachabilityStepMessage,
  stepLookup: Map<string, TraceReachabilityStepMessage>,
  predecessorLookup: Map<string, readonly string[]>,
  rankLookup: Map<string, number>,
  visiting: Set<string>,
): number {
  const storedRank = rankLookup.get(step.routeTemplatePath)

  if (storedRank !== undefined) {
    return storedRank
  }

  if (step.isEntryPoint || visiting.has(step.routeTemplatePath)) {
    rankLookup.set(step.routeTemplatePath, 0)

    return 0
  }

  visiting.add(step.routeTemplatePath)

  const predecessorRanks = (predecessorLookup.get(step.routeTemplatePath) ?? [])
    .map(path => stepLookup.get(path))
    .filter((predecessor): predecessor is TraceReachabilityStepMessage => predecessor !== undefined)
    .map(predecessor => rankStep(predecessor, stepLookup, predecessorLookup, rankLookup, visiting))

  visiting.delete(step.routeTemplatePath)

  const rank = predecessorRanks.length === 0 ? 0 : Math.max(...predecessorRanks) + 1
  rankLookup.set(step.routeTemplatePath, rank)

  return rank
}

function buildCurrentPathPairs(paths: readonly string[]): Set<string> {
  return new Set(paths.slice(0, -1).map((path, index) => `${path}->${paths[index + 1]}`))
}

function buildGraphEdges(reachability: TraceReachabilityMessage, nodeLookup: Map<string, GraphNode>): readonly GraphEdge[] {
  const currentPathPairs = buildCurrentPathPairs(reachability.canonicalPathRouteTemplatePaths)

  return reachability.steps.flatMap(step => {
    const from = nodeLookup.get(step.routeTemplatePath)

    if (from === undefined) {
      return []
    }

    const faint = !from.step.isReachable

    const evaluatedEdges = step.forwardRouteTemplatePaths
      .map(path => nodeLookup.get(path))
      .filter((to): to is GraphNode => to !== undefined)
      .map(to => {
        const pairKey = `${step.routeTemplatePath}->${to.step.routeTemplatePath}`
        const kind: GraphEdgeKind = currentPathPairs.has(pairKey) ? 'current' : 'evaluated'

        return { key: `${kind}:${pairKey}`, from, to, kind, faint }
      })

    const forwardPathSet = new Set(step.forwardRouteTemplatePaths)
    const rejectedEdges = (step.declaredForwardRouteTemplatePaths ?? [])
      .filter(path => !forwardPathSet.has(path))
      .map(path => nodeLookup.get(path))
      .filter((to): to is GraphNode => to !== undefined)
      .map(to => ({
        key: `rejected:${step.routeTemplatePath}->${to.step.routeTemplatePath}`,
        from,
        to,
        kind: 'rejected' as const,
        faint,
      }))

    return [...evaluatedEdges, ...rejectedEdges]
  })
}

// A forward target that ranks at or before its source draws a backward / same-rank elbow, which
// overshoots the stage on both sides. Detecting one lets the layout widen its horizontal padding.
function hasBackwardOrSameRankEdge(
  reachability: TraceReachabilityMessage,
  rankLookup: Map<string, number>,
): boolean {
  return reachability.steps.some(step => {
    const stepRank = rankLookup.get(step.routeTemplatePath)

    if (stepRank === undefined) {
      return false
    }

    const targetPaths = [...step.forwardRouteTemplatePaths, ...(step.declaredForwardRouteTemplatePaths ?? [])]

    return targetPaths.some(path => {
      const targetRank = rankLookup.get(path)

      return targetRank !== undefined && targetRank <= stepRank
    })
  })
}

function buildGraphLayout(reachability: TraceReachabilityMessage): GraphLayout {
  const stepLookup = buildStepLookup(reachability)
  const predecessorLookup = buildPredecessorLookup(reachability)
  const rankLookup = new Map<string, number>()
  const rankedSteps = reachability.steps.map(step => ({
    step,
    rank: rankStep(step, stepLookup, predecessorLookup, rankLookup, new Set()),
  }))
  const paddingX = hasBackwardOrSameRankEdge(reachability, rankLookup) ? STAGE_PADDING_X_LOOPED : STAGE_PADDING_X
  const rankCounts = new Map<number, number>()
  const nodes = rankedSteps
    .sort((a, b) => a.rank - b.rank || a.step.declarationIndex - b.step.declarationIndex)
    .map(({ step, rank }) => {
      const row = rankCounts.get(rank) ?? 0
      rankCounts.set(rank, row + 1)

      return {
        step,
        rank,
        x: paddingX + rank * COLUMN_PITCH,
        y: STAGE_PADDING_Y + row * ROW_PITCH,
      }
    })
  const nodeLookup = new Map(nodes.map(node => [node.step.routeTemplatePath, node]))
  const edges = buildGraphEdges(reachability, nodeLookup)
  const maxRank = Math.max(0, ...nodes.map(node => node.rank))
  const maxRows = Math.max(1, ...rankCounts.values())
  const width = paddingX * 2 + NODE_WIDTH + maxRank * COLUMN_PITCH
  const height = STAGE_PADDING_Y * 2 + NODE_HEIGHT + (maxRows - 1) * ROW_PITCH

  return { nodes, edges, width, height }
}

function edgePath(edge: GraphEdge): string {
  const startX = edge.from.x + NODE_WIDTH
  const startY = edge.from.y + NODE_HEIGHT / 2
  const endX = edge.to.x
  const endY = edge.to.y + NODE_HEIGHT / 2

  if (endX > startX) {
    const midX = startX + (endX - startX) / 2

    return `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`
  }

  const elbowY = Math.max(8, Math.min(edge.from.y, edge.to.y) - 6)

  return `M ${startX} ${startY} H ${startX + 24} V ${elbowY} H ${endX - 24} V ${endY} H ${endX}`
}

function edgeMarker(kind: GraphEdgeKind): string {
  if (kind === 'current') {
    return 'url(#reachability-arrow-path)'
  }

  if (kind === 'rejected') {
    return 'url(#reachability-arrow-rejected)'
  }

  return 'url(#reachability-arrow-edge)'
}

// --- Shared primitives ---

function StatusDot({ status }: { readonly status: StepStatus }) {
  return <span class={`reachability-dot reachability-dot--${status}`} />
}

type ChipKind = 'entry' | 'current' | 'frontier' | 'rejected'

function Chip({ kind, children }: { readonly kind: ChipKind; readonly children: string }) {
  return <span class={`reachability-chip reachability-chip--${kind}`}>{children}</span>
}

// --- Stat bar ---

function StatBar({
  reachability,
  stepLookup,
}: {
  readonly reachability: TraceReachabilityMessage
  readonly stepLookup: Map<string, TraceReachabilityStepMessage>
}) {
  const reachableCount = reachability.steps.filter(step => step.isReachable).length
  const unreachableCount = reachability.steps.length - reachableCount
  const invalidCount = reachability.steps.filter(step => statusFor(step) === 'invalid').length
  const entryCode = reachability.defaultEntryRouteTemplatePath !== undefined
    ? displayCodeForPath(reachability.defaultEntryRouteTemplatePath, stepLookup)
    : undefined
  const frontierCode = reachability.frontierRouteTemplatePath !== undefined
    ? displayCodeForPath(reachability.frontierRouteTemplatePath, stepLookup)
    : undefined

  return (
    <div class="reachability-view__statbar">
      <span class="reachability-view__stat"><b>{reachability.steps.length}</b> steps</span>
      <span class="reachability-view__stat"><StatusDot status="reachable" /> <b>{reachableCount}</b> reachable</span>
      <span class="reachability-view__stat"><StatusDot status="unreachable" /> <b>{unreachableCount}</b> unreachable</span>
      {invalidCount > 0 && (
        <span class="reachability-view__stat"><StatusDot status="invalid" /> <b>{invalidCount}</b> invalid</span>
      )}
      <span class="reachability-view__spacer" />
      {entryCode !== undefined && (
        <span class="reachability-view__stat">entry <b class="reachability-view__mono">{entryCode}</b></span>
      )}
      {frontierCode !== undefined && (
        <span class="reachability-view__stat">frontier <b class="reachability-view__mono">{frontierCode}</b></span>
      )}
      <span class="reachability-view__stat">resume <b>{reachability.resumeOutcome}</b></span>
    </div>
  )
}

// --- Graph ---

function StepGraph({
  reachability,
  stepValidities,
  rejectedTargetPaths,
  selectedStepId,
  onSelect,
}: {
  readonly reachability: TraceReachabilityMessage
  readonly stepValidities: Record<string, StepValidityMessage>
  readonly rejectedTargetPaths: Set<string>
  readonly selectedStepId: string | undefined
  readonly onSelect: (stepId: string) => void
}) {
  const layout = useMemo(() => buildGraphLayout(reachability), [reachability])

  if (layout.nodes.length === 0) {
    return <div class="empty-state">No reachability steps in this trace</div>
  }

  return (
    <div class="reachability-view__canvas">
      <div class="reachability-view__stage" style={{ width: `${layout.width}px`, height: `${layout.height}px` }}>
        <svg class="reachability-view__svg" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
          <defs>
            <marker id="reachability-arrow-edge" class="reachability-view__marker" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,0.8 L7,4 L0,7.2 Z" />
            </marker>
            <marker id="reachability-arrow-path" class="reachability-view__marker reachability-view__marker--path" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,0.8 L7,4 L0,7.2 Z" />
            </marker>
            <marker id="reachability-arrow-rejected" class="reachability-view__marker reachability-view__marker--rejected" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,0.8 L7,4 L0,7.2 Z" />
            </marker>
          </defs>
          {layout.edges.map(edge => (
            <path
              key={edge.key}
              class={`reachability-view__edge reachability-view__edge--${edge.kind}${edge.faint ? ' reachability-view__edge--faint' : ''}`}
              d={edgePath(edge)}
              marker-end={edgeMarker(edge.kind)}
            />
          ))}
        </svg>
        {layout.nodes.map(node => {
          const status = statusFor(node.step)
          const blockingCount = validationSummary(node.step, stepValidities).blockingFailures.length
          const meta = nodeMeta(node.step, reachability, blockingCount, rejectedTargetPaths.has(node.step.routeTemplatePath))
          const modifiers = [
            `reachability-view__node--${status}`,
            node.step.isReachable ? undefined : 'reachability-view__node--dim',
            node.step.stepId === selectedStepId ? 'reachability-view__node--highlighted' : undefined,
          ].filter(Boolean).join(' ')

          return (
            <div
              key={node.step.stepId}
              class={`reachability-view__node ${modifiers}`}
              style={{ left: `${node.x}px`, top: `${node.y}px` }}
              onClick={() => onSelect(node.step.stepId)}
            >
              <span class="reachability-view__node-code"><StatusDot status={status} />{displayStepName(node.step)}</span>
              <span class="reachability-view__node-meta">{meta}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Rail ---

function RailItem({
  step,
  reachability,
  selected,
  dim,
  rejected,
  onSelect,
}: {
  readonly step: TraceReachabilityStepMessage
  readonly reachability: TraceReachabilityMessage
  readonly selected: boolean
  readonly dim: boolean
  readonly rejected: boolean
  readonly onSelect: (stepId: string) => void
}) {
  const modifiers = [
    selected ? 'reachability-view__rail-item--selected' : undefined,
    dim ? 'reachability-view__rail-item--dim' : undefined,
  ].filter(Boolean).join(' ')

  return (
    <div
      class={`reachability-view__rail-item ${modifiers}`.trimEnd()}
      onClick={() => onSelect(step.stepId)}
    >
      <StatusDot status={statusFor(step)} />
      <span class="reachability-view__rail-code">{displayStepName(step)}</span>
      <span class="reachability-view__chips">
        {rejected ? (
          <Chip kind="rejected">rejected</Chip>
        ) : (
          <Fragment>
            {step.isEntryPoint && <Chip kind="entry">entry</Chip>}
            {reachability.currentStepId === step.stepId && <Chip kind="current">current</Chip>}
          </Fragment>
        )}
      </span>
    </div>
  )
}

function StepRail({
  reachability,
  stepLookup,
  selectedStepId,
  onSelect,
}: {
  readonly reachability: TraceReachabilityMessage
  readonly stepLookup: Map<string, TraceReachabilityStepMessage>
  readonly selectedStepId: string | undefined
  readonly onSelect: (stepId: string) => void
}) {
  const canonicalPaths = reachability.canonicalPathRouteTemplatePaths
  const canonicalSet = new Set(canonicalPaths)
  const canonicalSteps = canonicalPaths
    .map(path => stepLookup.get(path))
    .filter((step): step is TraceReachabilityStepMessage => step !== undefined)

  if (canonicalSteps.length === 0) {
    const sortedSteps = [...reachability.steps].sort((a, b) => a.declarationIndex - b.declarationIndex)

    return (
      <div class="reachability-view__rail">
        {sortedSteps.map(step => (
          <RailItem
            key={step.stepId}
            step={step}
            reachability={reachability}
            selected={step.stepId === selectedStepId}
            dim={false}
            rejected={false}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  const branchListedPaths = new Set<string>()
  const canonicalGroups = canonicalSteps.map(step => {
    const branches = rejectedTargetSteps(step, stepLookup).filter(branch => !canonicalSet.has(branch.routeTemplatePath))

    branches.forEach(branch => branchListedPaths.add(branch.routeTemplatePath))

    return { step, branches }
  })

  const remainingSteps = [...reachability.steps]
    .filter(step => !canonicalSet.has(step.routeTemplatePath) && !branchListedPaths.has(step.routeTemplatePath))
    .sort((a, b) => a.declarationIndex - b.declarationIndex)

  return (
    <div class="reachability-view__rail">
      <div class="reachability-view__rail-hint">Canonical path</div>
      {canonicalGroups.map(({ step, branches }) => (
        <Fragment key={step.stepId}>
          <RailItem
            step={step}
            reachability={reachability}
            selected={step.stepId === selectedStepId}
            dim={false}
            rejected={false}
            onSelect={onSelect}
          />
          {branches.length > 0 && (
            <div class="reachability-view__rail-branches">
              {branches.map(branch => (
                <RailItem
                  key={branch.stepId}
                  step={branch}
                  reachability={reachability}
                  selected={branch.stepId === selectedStepId}
                  dim={!branch.isReachable}
                  rejected
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </Fragment>
      ))}
      {remainingSteps.length > 0 && (
        <Fragment>
          <div class="reachability-view__rail-hint">Other steps</div>
          {remainingSteps.map(step => (
            <RailItem
              key={step.stepId}
              step={step}
              reachability={reachability}
              selected={step.stepId === selectedStepId}
              dim={!step.isReachable}
              rejected={false}
              onSelect={onSelect}
            />
          ))}
        </Fragment>
      )}
    </div>
  )
}

// --- Inspector ---

function FailureRows({ summary }: { readonly summary: StepValidationSummary }) {
  return (
    <Fragment>
      {summary.blockingFailures.map((failure, index) => (
        <div key={`blocking-${index}`} class="reachability-view__fail">
          <span class="reachability-view__fail-x">✕</span>
          <span>{failure.message}</span>
          {failure.blockCode !== undefined && <span class="reachability-view__fail-code">{failure.blockCode}</span>}
        </div>
      ))}
      {summary.informationalFailures.map((failure, index) => (
        <div key={`informational-${index}`} class="reachability-view__fail reachability-view__fail--info">
          <span class="reachability-view__fail-x">•</span>
          <span>{failure.message}</span>
          {failure.blockCode !== undefined && <span class="reachability-view__fail-code">{failure.blockCode}</span>}
          <span class="reachability-view__fail-note">
            {failure.submissionOnly ? 'submission-only, does not block reachability' : 'informational'}
          </span>
        </div>
      ))}
    </Fragment>
  )
}

function StepInspector({
  reachability,
  step,
  stepValidities,
  stepLookup,
}: {
  readonly reachability: TraceReachabilityMessage
  readonly step: TraceReachabilityStepMessage
  readonly stepValidities: Record<string, StepValidityMessage>
  readonly stepLookup: Map<string, TraceReachabilityStepMessage>
}) {
  const summary = validationSummary(step, stepValidities)
  const isCurrent = reachability.currentStepId === step.stepId
  const isFrontier = reachability.frontierRouteTemplatePath === step.routeTemplatePath
  const failureCount = summary.blockingFailures.length + summary.informationalFailures.length
  const hasFailures = failureCount > 0
  const declaredForwardPaths = step.declaredForwardRouteTemplatePaths ?? step.forwardRouteTemplatePaths
  const evaluatedPaths = new Set(step.forwardRouteTemplatePaths)
  const predecessorCodes = step.predecessorRouteTemplatePaths.map(path => displayCodeForPath(path, stepLookup))
  const entryPointText = step.isEntryPoint ? (step.isConditionalEntry ? 'yes (conditional)' : 'yes') : 'no'

  return (
    <div class="reachability-view__inspector">
      <div class="reachability-view__inspector-header">
        <StatusDot status={statusFor(step)} />
        <span class="reachability-view__inspector-code">{displayStepName(step)}</span>
        {isCurrent && <Chip kind="current">current</Chip>}
        {isFrontier && <Chip kind="frontier">frontier</Chip>}
        {step.isEntryPoint && <Chip kind="entry">entry</Chip>}
      </div>
      <div class="reachability-view__inspector-route">{step.routeTemplatePath}</div>
      <dl class="reachability-view__props">
        <dt>Reachable</dt>
        <dd class={step.isReachable ? 'reachability-view__val--yes' : 'reachability-view__val--no'}>
          {step.isReachable ? 'yes' : 'no'}
        </dd>
        <dt>Blocks reachability</dt>
        <dd class={step.isValid ? 'reachability-view__val--yes' : 'reachability-view__val--no'}>
          {step.isValid ? 'no' : 'yes'}
          {isCurrent && step.isValid && summary.blockingFailures.length > 0 && (
            <span class="reachability-view__val-note"> — validity not enforced for the current step</span>
          )}
        </dd>
        {step.hasValidation && (
          <Fragment>
            <dt>Validation</dt>
            {failureCount > 0 ? (
              <dd class="reachability-view__val--no">
                {`${failureCount} ${failureCount === 1 ? 'failure' : 'failures'} against current answers`}
              </dd>
            ) : (
              <dd class="reachability-view__val--yes">no failures</dd>
            )}
          </Fragment>
        )}
        <dt>Entry point</dt>
        <dd>{entryPointText}</dd>
        <dt>Has validation</dt>
        <dd>{step.hasValidation ? 'yes' : 'no'}</dd>
        <dt>Declaration index</dt>
        <dd>{step.declarationIndex}</dd>
        <dt>Step id</dt>
        <dd class="reachability-view__mono">{step.stepId}</dd>
        {step.tieBreakerPriority !== undefined && (
          <Fragment>
            <dt>Tie-breaker priority</dt>
            <dd>{step.tieBreakerPriority}</dd>
          </Fragment>
        )}
        <dt>Predecessors</dt>
        <dd class="reachability-view__mono">{predecessorCodes.length > 0 ? predecessorCodes.join(', ') : '—'}</dd>
      </dl>
      {hasFailures && (
        <Fragment>
          <h4 class="reachability-view__section-title">Validation failures</h4>
          <FailureRows summary={summary} />
        </Fragment>
      )}
      {declaredForwardPaths.length > 0 && (
        <Fragment>
          <h4 class="reachability-view__section-title">Navigation</h4>
          {declaredForwardPaths.map(path => {
            const evaluated = evaluatedPaths.has(path)

            return (
              <div
                key={path}
                class={`reachability-view__nav-edge${evaluated ? '' : ' reachability-view__nav-edge--rejected'}`}
              >
                <span class="reachability-view__nav-arrow">→</span>
                <span class="reachability-view__mono reachability-view__nav-code">{displayCodeForPath(path, stepLookup)}</span>
                <span class="reachability-view__nav-note">{evaluated ? 'evaluated' : 'declared, rejected'}</span>
              </div>
            )
          })}
        </Fragment>
      )}
      {step.predecessorRouteTemplatePaths.length > 0 && (
        <Fragment>
          <h4 class="reachability-view__section-title">Arrived via</h4>
          {step.predecessorRouteTemplatePaths.map(path => (
            <div key={path} class="reachability-view__nav-edge">
              <span class="reachability-view__nav-arrow">←</span>
              <span class="reachability-view__mono reachability-view__nav-code">{displayCodeForPath(path, stepLookup)}</span>
            </div>
          ))}
        </Fragment>
      )}
    </div>
  )
}

// --- Container ---

function resolveSelectedStepId(
  selectedStepId: string | undefined,
  reachability: TraceReachabilityMessage,
  sortedSteps: readonly TraceReachabilityStepMessage[],
): string | undefined {
  if (selectedStepId !== undefined && reachability.steps.some(step => step.stepId === selectedStepId)) {
    return selectedStepId
  }

  if (reachability.currentStepId !== undefined && reachability.steps.some(step => step.stepId === reachability.currentStepId)) {
    return reachability.currentStepId
  }

  return sortedSteps[0]?.stepId
}

export default function ReachabilityView({ trace }: ReachabilityViewProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>(undefined)

  // A new trace re-defaults selection to its own current step.
  useEffect(() => {
    setSelectedStepId(undefined)
  }, [trace])

  if (!trace) {
    return <div class="empty-state">Select a trace to view details</div>
  }

  const reachability = trace.trace.reachability

  if (reachability === undefined) {
    return <div class="empty-state">No reachability data in this trace</div>
  }

  const stepLookup = buildStepLookup(reachability)
  const stepValidities = latestStepValidities(trace)
  const rejectedTargetPaths = collectRejectedTargetPaths(reachability)
  const sortedSteps = [...reachability.steps].sort((a, b) => a.declarationIndex - b.declarationIndex)
  const effectiveSelectedStepId = resolveSelectedStepId(selectedStepId, reachability, sortedSteps)
  const selectedStep = reachability.steps.find(step => step.stepId === effectiveSelectedStepId)

  return (
    <div class="reachability-view">
      <StatBar reachability={reachability} stepLookup={stepLookup} />
      <StepGraph
        reachability={reachability}
        stepValidities={stepValidities}
        rejectedTargetPaths={rejectedTargetPaths}
        selectedStepId={effectiveSelectedStepId}
        onSelect={setSelectedStepId}
      />
      <div class="reachability-view__split">
        <StepRail
          reachability={reachability}
          stepLookup={stepLookup}
          selectedStepId={effectiveSelectedStepId}
          onSelect={setSelectedStepId}
        />
        {selectedStep !== undefined && (
          <StepInspector
            reachability={reachability}
            step={selectedStep}
            stepValidities={stepValidities}
            stepLookup={stepLookup}
          />
        )}
      </div>
    </div>
  )
}
