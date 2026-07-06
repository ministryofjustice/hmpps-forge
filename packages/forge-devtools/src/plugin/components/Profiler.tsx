import { h, type RefObject } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { TraceMessage, TraceUnitMessage } from '../hooks/useConnection'
import UnitDetail from './UnitDetail'
import { clearBlockHighlight, highlightBlock } from '../blockHighlight'

// --- Constants ---

const ROW_HEIGHT = 15
const ROW_PITCH = 17

// A pointer move beyond this many pixels between mousedown and mouseup counts as a
// pan drag, so the trailing click must not be treated as a bar selection.
const DRAG_THRESHOLD = 4

// Flame-bar palette. Each fill/border pair is a pair of CSS custom properties defined on
// `.profiler` in Profiler.scss (light pastels with dark text; deep muted fills with light text
// under `:root.dark`), so the bars follow the panel theme. The var() references inherit down to
// the bar/swatch/donut elements and are applied via inline `style`, never as SVG attributes
// (var() does not resolve in SVG presentation attributes).
interface CategoryColor {
  readonly fill: string
  readonly border: string
}

const CATEGORY_COLORS: Record<string, CategoryColor> = {
  request: { fill: 'var(--profiler-cat-request-fill)', border: 'var(--profiler-cat-request-border)' },
  hooks: { fill: 'var(--profiler-cat-hooks-fill)', border: 'var(--profiler-cat-hooks-border)' },
  validation: { fill: 'var(--profiler-cat-validation-fill)', border: 'var(--profiler-cat-validation-border)' },
  preparation: { fill: 'var(--profiler-cat-preparation-fill)', border: 'var(--profiler-cat-preparation-border)' },
  navigation: { fill: 'var(--profiler-cat-navigation-fill)', border: 'var(--profiler-cat-navigation-border)' },
  'render-evaluation': { fill: 'var(--profiler-cat-render-evaluation-fill)', border: 'var(--profiler-cat-render-evaluation-border)' },
  'render-output': { fill: 'var(--profiler-cat-render-output-fill)', border: 'var(--profiler-cat-render-output-border)' },
}

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  request: 'Pipeline',
  hooks: 'Hooks',
  validation: 'Validation',
  preparation: 'Preparation',
  navigation: 'Navigation',
  'render-evaluation': 'Render (evaluation)',
  'render-output': 'Render (output)',
}

const EMPTY_UNITS: ReadonlySet<TraceUnitMessage> = new Set()

// --- Helpers ---

function categoryFor(kind: string): string {
  if (kind === 'request') {
    return 'request'
  }

  // submit.validation must be checked before the submit. prefix claims it for hooks.
  if (kind.startsWith('validation.') || kind === 'submit.validation' || kind === 'entry-validation' || kind === 'validities') {
    return 'validation'
  }

  if (kind.startsWith('answer.preparation') || kind === 'answer-preparation' || kind === 'answer-cleardown' || kind === 'context-preparation') {
    return 'preparation'
  }

  if (kind.startsWith('access.') || kind.startsWith('submit.') || kind.startsWith('hook.') || kind === 'access' || kind === 'submit') {
    return 'hooks'
  }

  if (kind.startsWith('reachability.') || kind === 'reachability' || kind === 'route-tree') {
    return 'navigation'
  }

  if (kind.startsWith('resolve.') || kind === 'resolve') {
    return 'render-evaluation'
  }

  if (kind.startsWith('render.') || kind === 'render') {
    return 'render-output'
  }

  return 'request'
}

function colorFor(category: string): CategoryColor {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.request
}

function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (ms >= 1) {
    return `${ms.toFixed(2)}ms`
  }

  return `${(ms * 1000).toFixed(1)}µs`
}

function formatPercent(ms: number, totalMs: number): string {
  if (totalMs <= 0) {
    return '0%'
  }

  return `${((ms / totalMs) * 100).toFixed(1)}%`
}

function shortNodeId(nodeId: string): string {
  const segments = nodeId.split('::')

  return segments[segments.length - 1]
}

function unitLabel(unit: TraceUnitMessage): string {
  const kindLabel = unit.kind.replaceAll('-', ' ').replaceAll('.', ' ')

  if (unit.variant) {
    return `${kindLabel}: ${unit.variant}`
  }

  if (unit.nodeId) {
    return `${kindLabel}: ${shortNodeId(unit.nodeId)}`
  }

  return kindLabel
}

function capitalize(value: string): string {
  if (value.length === 0) {
    return value
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Self time falls back to the total duration for units the engine never split out.
function selfDurationOf(unit: TraceUnitMessage): number {
  return unit.selfDurationMs ?? unit.durationMs ?? 0
}

// --- Flamegraph data ---

// Two measured synchronous spans (begin, complete) per unit never overlap or nest within a
// request, so a node's execution intervals only ever need coalescing to bridge this much
// floating-point jitter — there are no true overlaps to merge.
const COALESCE_EPSILON_MS = 0.01

interface Interval {
  readonly start: number
  readonly end: number
}

interface FlamegraphNode {
  readonly key: string
  readonly depth: number
  readonly intervals: readonly Interval[]
  readonly envelope: Interval
  readonly spansEnvelope: boolean
  readonly label: string
  readonly category: string
  readonly unit?: TraceUnitMessage
}

// Timing jitter can put a child a fraction outside its parent, so clamp the
// interval into the [0, 1] timeline rather than letting it overflow the request span.
function clampToTimeline(startMs: number, durationMs: number, origin: number, totalMs: number): Interval {
  const start = Math.min(Math.max((startMs - origin) / totalMs, 0), 1)
  const end = start + Math.min(durationMs / totalMs, 1 - start)

  return { start, end }
}

function coalesceIntervals(intervals: readonly Interval[], epsilon: number): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = []

  sorted.forEach(interval => {
    const last = merged[merged.length - 1]

    if (last !== undefined && interval.start <= last.end + epsilon) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, interval.end) }

      return
    }

    merged.push(interval)
  })

  return merged
}

function intervalsSpanEnvelope(intervals: readonly Interval[], envelope: Interval, epsilon: number): boolean {
  return (
    intervals.length === 1 &&
    intervals[0].start <= envelope.start + epsilon &&
    intervals[0].end >= envelope.end - epsilon
  )
}

function traceHasSlices(trace: TraceMessage): boolean {
  return collectAllUnits(trace).some(unit => (unit.executionSlices?.length ?? 0) > 0)
}

function appendUnitNodes(
  unit: TraceUnitMessage,
  depth: number,
  key: string,
  origin: number,
  totalMs: number,
  hasSlices: boolean,
  coalesceEpsilon: number,
  nodes: FlamegraphNode[],
): readonly Interval[] {
  if (unit.startedAtMs === undefined || unit.durationMs === undefined) {
    return []
  }

  const envelope = clampToTimeline(unit.startedAtMs, unit.durationMs, origin, totalMs)
  const childIntervals = (unit.children ?? []).flatMap((child, childIndex) =>
    appendUnitNodes(child, depth + 1, `${key}:u${childIndex}`, origin, totalMs, hasSlices, coalesceEpsilon, nodes),
  )

  const ownIntervals = (unit.executionSlices ?? []).map(slice =>
    clampToTimeline(slice.startedAtMs, slice.completedAtMs - slice.startedAtMs, origin, totalMs),
  )
  const intervals = hasSlices ? coalesceIntervals([...ownIntervals, ...childIntervals], coalesceEpsilon) : [envelope]
  const activeMs = intervals.reduce((total, interval) => total + (interval.end - interval.start), 0) * totalMs

  nodes.push({
    key,
    depth,
    intervals,
    envelope,
    spansEnvelope: intervalsSpanEnvelope(intervals, envelope, coalesceEpsilon),
    label: `${unitLabel(unit)} (${formatMs(activeMs)})`,
    category: categoryFor(unit.kind),
    unit,
  })

  return intervals
}

function buildFlamegraphNodes(trace: TraceMessage): readonly FlamegraphNode[] {
  const origin = trace.trace.startedAtMs
  const totalMs = trace.trace.durationMs

  if (totalMs === 0) {
    return []
  }

  const coalesceEpsilon = COALESCE_EPSILON_MS / totalMs
  const hasSlices = traceHasSlices(trace)
  const nodes: FlamegraphNode[] = []
  const requestInterval: Interval = { start: 0, end: 1 }

  nodes.push({
    key: 'request',
    depth: 0,
    intervals: [requestInterval],
    envelope: requestInterval,
    spansEnvelope: true,
    label: `Request (${formatMs(totalMs)})`,
    category: 'request',
  })

  trace.trace.phases.forEach((phase, phaseIndex) => {
    const envelope = clampToTimeline(phase.startedAtMs, phase.durationMs, origin, totalMs)

    // Phases render as a uniform grey top track (Chrome's Timings-track idiom); only the
    // units below them carry category hues.
    nodes.push({
      key: `p${phaseIndex}`,
      depth: 1,
      intervals: [envelope],
      envelope,
      spansEnvelope: true,
      label: `${phase.phase} (${formatMs(phase.durationMs)})`,
      category: 'request',
    })

    phase.units.forEach((unit, unitIndex) => {
      appendUnitNodes(unit, 2, `p${phaseIndex}:u${unitIndex}`, origin, totalMs, hasSlices, coalesceEpsilon, nodes)
    })
  })

  // Same-row segments must paint in ascending start order so a sibling's genuine 1px sliver
  // lands on top of a neighbour's gap-merged fill rather than under it.
  return nodes.sort((a, b) => a.depth - b.depth || (a.intervals[0]?.start ?? a.envelope.start) - (b.intervals[0]?.start ?? b.envelope.start))
}

// --- Flamegraph projection ---

interface PixelSegment {
  readonly x: number
  readonly width: number
}

function projectIntervals(intervals: readonly Interval[], view: ViewPort, containerWidth: number): PixelSegment[] {
  const viewWidth = view.end - view.start
  const projected: { start: number; end: number }[] = []

  intervals.forEach(interval => {
    const renderStart = (interval.start - view.start) / viewWidth
    const renderEnd = (interval.end - view.start) / viewWidth

    if (renderEnd <= 0 || renderStart >= 1) {
      return
    }

    projected.push({ start: Math.max(renderStart, 0) * containerWidth, end: Math.min(renderEnd, 1) * containerWidth })
  })

  projected.sort((a, b) => a.start - b.start)

  // Bridge gaps that project under 1px so pixel-adjacent intervals paint as one fill.
  const merged: { start: number; end: number }[] = []

  projected.forEach(segment => {
    const last = merged[merged.length - 1]

    if (last !== undefined && segment.start - last.end < 1) {
      last.end = Math.max(last.end, segment.end)

      return
    }

    merged.push({ ...segment })
  })

  const segments: PixelSegment[] = []

  merged.forEach(segment => {
    const rawWidth = segment.end - segment.start

    // Once a node has a real segment, drop the sub-pixel remainder so µs-slivers at the request
    // origin do not sprout confetti; the first segment always survives to keep the node visible.
    if (rawWidth < 0.5 && segments.length > 0) {
      return
    }

    segments.push({ x: segment.start, width: Math.max(rawWidth, 1) })
  })

  return segments
}

function widestSegment(segments: readonly PixelSegment[]): PixelSegment | undefined {
  return segments.reduce<PixelSegment | undefined>(
    (widest, segment) => (widest === undefined || segment.width > widest.width ? segment : widest),
    undefined,
  )
}

// --- Viewport types ---

interface ViewPort {
  readonly start: number
  readonly end: number
}

interface HorizontalViewport {
  readonly containerRef: RefObject<HTMLDivElement>
  readonly containerWidth: number
  readonly view: ViewPort
  readonly isZoomed: boolean
  readonly isPanning: boolean
  readonly handlePanStart: (event: MouseEvent) => void
  readonly resetZoom: () => void
}

function useHorizontalViewport(resetKey: unknown): HorizontalViewport {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [view, setView] = useState<ViewPort>({ start: 0, end: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const viewRef = useRef<ViewPort>({ start: 0, end: 1 })

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width

      // Defer the state update out of the observer's delivery cycle: setting width synchronously
      // resizes the svg, which resizes the observed container again in the same frame, tripping
      // Chrome's "ResizeObserver loop completed with undelivered notifications" warning.
      requestAnimationFrame(() => setContainerWidth(width))
    })

    observer.observe(containerRef.current)

    return () => observer.disconnect()
    // Re-attach when the trace changes: the canvas ref is null while no trace is selected, so
    // the effect must re-run once a trace mounts the chart or containerWidth stays 0 forever.
  }, [resetKey])

  useEffect(() => {
    const reset = { start: 0, end: 1 }

    viewRef.current = reset
    setView(reset)
  }, [resetKey])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      const { start, end } = viewRef.current
      const viewWidth = end - start
      const isCurrentlyZoomed = viewWidth < 0.999

      if (!isCurrentlyZoomed && event.deltaY >= 0 && event.deltaX === 0) {
        return
      }

      if (!isCurrentlyZoomed && event.deltaY === 0) {
        return
      }

      event.preventDefault()

      const rect = container.getBoundingClientRect()
      let newStart = start
      let newEnd = end

      if (event.deltaY !== 0) {
        const mouseX = event.clientX - rect.left
        const mouseRatio = mouseX / rect.width
        const dataX = start + mouseRatio * viewWidth

        const zoomFactor = Math.exp(event.deltaY * 0.001)
        const newWidth = Math.min(1, Math.max(0.001, viewWidth * zoomFactor))

        newStart = dataX - mouseRatio * newWidth
        newEnd = newStart + newWidth
      }

      if (event.deltaX !== 0 && (newEnd - newStart) < 0.999) {
        const panAmount = (event.deltaX / rect.width) * (newEnd - newStart)

        newStart += panAmount
        newEnd += panAmount
      }

      if (newStart < 0) {
        newEnd -= newStart
        newStart = 0
      }

      if (newEnd > 1) {
        newStart -= newEnd - 1
        newEnd = 1
      }

      const clamped = { start: Math.max(0, newStart), end: Math.min(1, newEnd) }

      viewRef.current = clamped
      setView(clamped)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => container.removeEventListener('wheel', handleWheel)
    // Re-attach when the trace changes: the canvas ref is null while no trace is selected, so
    // the wheel listener must be bound once a trace mounts the chart.
  }, [resetKey])

  const viewWidth = view.end - view.start
  const isZoomed = viewWidth < 0.999

  const handlePanStart = (event: MouseEvent) => {
    const scrollContainer = containerRef.current?.closest('.profiler__chart') as HTMLElement | undefined
    const canScrollVertically = scrollContainer ? scrollContainer.scrollHeight > scrollContainer.clientHeight : false

    if (!isZoomed && !canScrollVertically) {
      return
    }

    event.preventDefault()
    setIsPanning(true)

    const startX = event.clientX
    const startY = event.clientY
    const startView = { ...viewRef.current }
    const startScrollTop = scrollContainer?.scrollTop ?? 0

    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (scrollContainer) {
        scrollContainer.scrollTop = startScrollTop - (moveEvent.clientY - startY)
      }

      if (!isZoomed) {
        return
      }

      const currentWidth = containerRef.current?.getBoundingClientRect().width ?? containerWidth
      const deltaPx = moveEvent.clientX - startX
      const width = startView.end - startView.start
      const deltaData = -(deltaPx / currentWidth) * width
      let newStart = startView.start + deltaData
      let newEnd = startView.end + deltaData

      if (newStart < 0) {
        newEnd -= newStart
        newStart = 0
      }

      if (newEnd > 1) {
        newStart -= newEnd - 1
        newEnd = 1
      }

      const clamped = { start: Math.max(0, newStart), end: Math.min(1, newEnd) }

      viewRef.current = clamped
      setView(clamped)
    }

    const handleMouseUp = () => {
      setIsPanning(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const resetZoom = () => {
    const reset = { start: 0, end: 1 }

    viewRef.current = reset
    setView(reset)
  }

  return {
    containerRef,
    containerWidth,
    view,
    isZoomed,
    isPanning,
    handlePanStart,
    resetZoom,
  }
}

// --- Time ruler ---

interface TimeTick {
  readonly x: number
  readonly label: string
}

// Round a raw step up to the nearest 1/2/5 × 10^n so ruler ticks land on human ms values.
function niceTimeStep(rawStep: number): number {
  if (rawStep <= 0) {
    return 1
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const normalized = rawStep / magnitude
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10

  return niceNormalized * magnitude
}

function buildTimeTicks(view: ViewPort, totalMs: number, containerWidth: number): readonly TimeTick[] {
  if (totalMs <= 0 || containerWidth <= 0) {
    return []
  }

  const viewWidth = view.end - view.start
  const viewStartMs = view.start * totalMs
  const viewEndMs = view.end * totalMs

  // Target roughly 8 ticks across the visible span, then snap to a nice step.
  const step = niceTimeStep((viewEndMs - viewStartMs) / 8)
  const decimals = step < 1 ? Math.min(3, Math.ceil(-Math.log10(step))) : 0
  const firstTick = Math.ceil(viewStartMs / step) * step
  const tickCount = Math.max(0, Math.floor((viewEndMs - firstTick) / step) + 1)

  return Array.from({ length: tickCount }, (unused, index) => {
    const timeMs = firstTick + index * step
    const x = ((timeMs / totalMs - view.start) / viewWidth) * containerWidth

    return { x, label: `${timeMs.toFixed(decimals)} ms` }
  })
}

// --- Unit collection ---

function collectAllUnits(trace: TraceMessage): TraceUnitMessage[] {
  const units: TraceUnitMessage[] = []

  function walk(items: readonly TraceUnitMessage[]): void {
    items.forEach(item => {
      units.push(item)

      if (item.children) {
        walk(item.children)
      }
    })
  }

  trace.trace.phases.forEach(phase => walk(phase.units))

  return units
}

function collectSubtree(unit: TraceUnitMessage): TraceUnitMessage[] {
  const units: TraceUnitMessage[] = [unit]

  ;(unit.children ?? []).forEach(child => units.push(...collectSubtree(child)))

  return units
}

// --- Summary aggregation ---

interface CategorySummarySegment {
  readonly category: string
  readonly name: string
  readonly color: CategoryColor
  readonly durationMs: number
  readonly fraction: number
}

function buildCategorySummary(units: readonly TraceUnitMessage[], centreMs: number): readonly CategorySummarySegment[] {
  const selfByCategory = new Map<string, number>()

  units.forEach(unit => {
    const self = selfDurationOf(unit)

    if (self <= 0) {
      return
    }

    const category = categoryFor(unit.kind)
    selfByCategory.set(category, (selfByCategory.get(category) ?? 0) + self)
  })

  const attributed = [...selfByCategory.values()].reduce((total, value) => total + value, 0)
  const remainder = Math.max(0, centreMs - attributed)

  // Time the units never accounted for belongs to the surrounding pipeline machinery.
  selfByCategory.set('request', (selfByCategory.get('request') ?? 0) + remainder)

  const present = [...selfByCategory.entries()].filter(([, ms]) => ms > 0)
  const nonPipeline = present.filter(([category]) => category !== 'request').sort((a, b) => b[1] - a[1])
  const pipeline = present.filter(([category]) => category === 'request')

  return [...nonPipeline, ...pipeline].map(([category, ms]) => ({
    category,
    name: CATEGORY_DISPLAY_NAMES[category] ?? category,
    color: colorFor(category),
    durationMs: ms,
    fraction: centreMs > 0 ? ms / centreMs : 0,
  }))
}

// --- Bottom-Up aggregation ---

interface UnitAggregate {
  readonly kind: string
  readonly category: string
  readonly color: CategoryColor
  readonly units: readonly TraceUnitMessage[]
  readonly selfMs: number
  readonly totalMs: number
  readonly heaviestUnit: TraceUnitMessage
  readonly variantInfo: string
}

function aggregateVariantInfo(units: readonly TraceUnitMessage[]): string {
  const variants = [...new Set(units.filter(unit => unit.variant !== undefined).map(unit => unit.variant as string))]

  if (units.length === 1) {
    return variants[0] ?? ''
  }

  if (variants.length > 0 && variants.length <= 2) {
    return variants.join(', ')
  }

  return `×${units.length}`
}

function childRowLabel(unit: TraceUnitMessage): string {
  if (unit.variant) {
    return unit.variant
  }

  if (unit.nodeId) {
    return shortNodeId(unit.nodeId)
  }

  return unit.kind
}

interface KindAccumulator {
  readonly units: TraceUnitMessage[]
  selfMs: number
  totalMs: number
}

function buildAggregates(trace: TraceMessage): readonly UnitAggregate[] {
  const byKind = new Map<string, KindAccumulator>()

  function walk(units: readonly TraceUnitMessage[], ancestorKinds: ReadonlySet<string>): void {
    units.forEach(unit => {
      const accumulator = byKind.get(unit.kind) ?? { units: [], selfMs: 0, totalMs: 0 }
      accumulator.units.push(unit)
      accumulator.selfMs += selfDurationOf(unit)

      // Total time double-counts if a same-kind unit nests inside another, so only the
      // outermost unit of each kind contributes its full duration.
      if (!ancestorKinds.has(unit.kind)) {
        accumulator.totalMs += unit.durationMs ?? 0
      }

      byKind.set(unit.kind, accumulator)

      const childAncestors = ancestorKinds.has(unit.kind) ? ancestorKinds : new Set([...ancestorKinds, unit.kind])
      walk(unit.children ?? [], childAncestors)
    })
  }

  trace.trace.phases.forEach(phase => walk(phase.units, new Set()))

  const aggregates = [...byKind.entries()].map(([kind, accumulator]) => {
    const category = categoryFor(kind)
    const heaviestUnit = accumulator.units.reduce(
      (heaviest, unit) => (selfDurationOf(unit) > selfDurationOf(heaviest) ? unit : heaviest),
      accumulator.units[0],
    )

    return {
      kind,
      category,
      color: colorFor(category),
      units: accumulator.units,
      selfMs: accumulator.selfMs,
      totalMs: accumulator.totalMs,
      heaviestUnit,
      variantInfo: aggregateVariantInfo(accumulator.units),
    }
  })

  return aggregates.sort((a, b) => b.selfMs - a.selfMs)
}

// --- Flame chart component ---

interface FlamegraphProps {
  readonly trace: TraceMessage
  readonly viewport: HorizontalViewport
  readonly selectedUnit: TraceUnitMessage | undefined
  readonly hoverUnits: ReadonlySet<TraceUnitMessage>
  readonly onBarSelect: (unit: TraceUnitMessage) => void
  readonly onBackgroundClick: () => void
}

function Flamegraph({ trace, viewport, selectedUnit, hoverUnits, onBarSelect, onBackgroundClick }: FlamegraphProps) {
  const { containerRef, containerWidth, view, isPanning, handlePanStart } = viewport
  const pointerRef = useRef({ x: 0, y: 0, moved: false })

  // Drop any page highlight when the trace changes or the flame chart unmounts (e.g. tab switch).
  useEffect(() => () => clearBlockHighlight(), [trace])

  // Building the node tree walks the whole trace and coalesces intervals, so memoise it: panning
  // re-renders at ~60Hz and only the pixel projection below needs to run on every frame.
  const nodes = useMemo(() => buildFlamegraphNodes(trace), [trace])
  const maxDepth = nodes.reduce((max, node) => Math.max(max, node.depth), 0)
  const canvasHeight = (maxDepth + 1) * ROW_PITCH
  const ticks = useMemo(() => buildTimeTicks(view, trace.trace.durationMs, containerWidth), [view, trace, containerWidth])

  const handleMouseDown = (event: MouseEvent) => {
    pointerRef.current = { x: event.clientX, y: event.clientY, moved: false }
    handlePanStart(event)
  }

  const handleMouseMove = (event: MouseEvent) => {
    const pointer = pointerRef.current

    if (pointer.moved) {
      return
    }

    if (Math.abs(event.clientX - pointer.x) > DRAG_THRESHOLD || Math.abs(event.clientY - pointer.y) > DRAG_THRESHOLD) {
      pointerRef.current = { ...pointer, moved: true }
    }
  }

  const handleBackgroundClick = () => {
    if (pointerRef.current.moved) {
      return
    }

    onBackgroundClick()
  }

  const handleNodeClick = (event: MouseEvent, unit: TraceUnitMessage) => {
    event.stopPropagation()

    if (pointerRef.current.moved) {
      return
    }

    onBarSelect(unit)
  }

  const handleNodeEnter = (node: FlamegraphNode) => {
    const unit = node.unit

    if (!unit?.nodeId) {
      clearBlockHighlight()

      return
    }

    highlightBlock(unit.nodeId, unit.variant ?? unit.nodeId)
  }

  return (
    <div class="profiler__chart">
      {containerWidth > 0 && (
        <div class="profiler__ruler">
          {ticks.map((tick, index) => (
            <span key={index} class="profiler__tick-label" style={{ left: tick.x }}>{tick.label}</span>
          ))}
        </div>
      )}
      <div
        ref={containerRef}
        class={`profiler__canvas${isPanning ? ' profiler__canvas--panning' : ''}`}
        style={{ height: canvasHeight }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleBackgroundClick}
        onMouseLeave={clearBlockHighlight}
      >
        {containerWidth > 0 && ticks.map((tick, index) => (
          <div key={`grid-${index}`} class="profiler__gridline" style={{ left: tick.x }} />
        ))}
        {containerWidth > 0 && nodes.flatMap(node => {
          const envelopeSegments = projectIntervals([node.envelope], view, containerWidth)

          if (envelopeSegments.length === 0) {
            return []
          }

          const segments = projectIntervals(node.intervals, view, containerWidth)
          const label = widestSegment(segments)
          const top = node.depth * ROW_PITCH
          const color = colorFor(node.category)
          const isSelected = node.unit !== undefined && node.unit === selectedUnit
          const isHovered = node.unit !== undefined && hoverUnits.has(node.unit)
          const state = isSelected ? ' profiler-bar--selected' : isHovered ? ' profiler-bar--hovered' : ''
          const phase = node.category === 'request' ? ' profiler-bar--phase' : ''
          const clickable = node.unit ? ' profiler-bar--clickable' : ''
          const unit = node.unit

          return segments.map((segment, index) => (
            <div
              key={`${node.key}-${index}`}
              class={`profiler-bar${phase}${clickable}${state}`}
              style={{ left: segment.x, width: segment.width, top, background: color.fill, borderColor: color.border }}
              onClick={unit ? (event: MouseEvent) => handleNodeClick(event, unit) : undefined}
              onMouseEnter={() => handleNodeEnter(node)}
            >
              {segment === label && label.width > 24 && <span class="profiler-bar__label">{node.label}</span>}
            </div>
          ))
        })}
      </div>
    </div>
  )
}

// --- Summary pane ---

const DONUT_RADIUS = 42
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

interface SummaryPaneProps {
  readonly segments: readonly CategorySummarySegment[]
  readonly centreMs: number
}

function SummaryPane({ segments, centreMs }: SummaryPaneProps) {
  if (segments.length === 0) {
    return <div class="profiler__empty">No timing data</div>
  }

  let offset = 0
  const arcs = segments.map(segment => {
    const length = segment.fraction * DONUT_CIRCUMFERENCE
    const arc = { color: segment.color.fill, length, offset }
    offset += length

    return arc
  })

  return (
    <div class="profiler__summary">
      <div class="profiler__donut">
        <svg viewBox="0 0 116 116" aria-hidden="true">
          <g transform="rotate(-90 58 58)" fill="none" stroke-width="16">
            {arcs.map((arc, index) => (
              <circle
                key={index}
                cx="58"
                cy="58"
                r={DONUT_RADIUS}
                style={{ stroke: arc.color }}
                stroke-dasharray={`${arc.length} ${DONUT_CIRCUMFERENCE}`}
                stroke-dashoffset={-arc.offset}
              />
            ))}
          </g>
        </svg>
        <div class="profiler__donut-total">{formatMs(centreMs)}<span>total</span></div>
      </div>
      <div class="profiler__legend">
        {segments.map(segment => (
          <div key={segment.category} class="profiler__legend-row">
            <span class="profiler__legend-name">
              <span class="profiler__swatch" style={{ background: segment.color.fill, borderColor: segment.color.border }} />
              {segment.name}
            </span>
            <span class="profiler__legend-time">{formatMs(segment.durationMs)}</span>
            <span class="profiler__legend-pct">{formatPercent(segment.durationMs, centreMs)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Bottom-Up table ---

interface BottomUpTableProps {
  readonly aggregates: readonly UnitAggregate[]
  readonly traceTotalMs: number
  readonly selectedUnit: TraceUnitMessage | undefined
  readonly expandedKinds: ReadonlySet<string>
  readonly onToggleKind: (kind: string) => void
  readonly onSelectUnit: (unit: TraceUnitMessage) => void
  readonly onHoverUnits: (units: readonly TraceUnitMessage[]) => void
  readonly onClearHover: () => void
}

function BottomUpTable({
  aggregates,
  traceTotalMs,
  selectedUnit,
  expandedKinds,
  onToggleKind,
  onSelectUnit,
  onHoverUnits,
  onClearHover,
}: BottomUpTableProps) {
  if (aggregates.length === 0) {
    return <div class="profiler__empty">No timing data</div>
  }

  return (
    <div class="profiler__table">
      <table>
        <colgroup>
          <col class="profiler__col-time" />
          <col class="profiler__col-time" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th class="profiler__th--sorted">Self time ▾</th>
            <th>Total time</th>
            <th>Activity</th>
          </tr>
        </thead>
        {aggregates.map(aggregate => {
            const expandable = aggregate.units.length > 1
            const expanded = expandedKinds.has(aggregate.kind)
            const parentSelected = aggregate.units.some(unit => unit === selectedUnit)
            const children = expanded
              ? [...aggregate.units].sort((a, b) => selfDurationOf(b) - selfDurationOf(a))
              : []

            return (
              <tbody key={aggregate.kind} class="profiler__group">
                <tr
                  class={`profiler__row${parentSelected ? ' profiler__row--selected' : ''}`}
                  onClick={() => onSelectUnit(aggregate.heaviestUnit)}
                  onMouseEnter={() => onHoverUnits(aggregate.units)}
                  onMouseLeave={onClearHover}
                >
                  <td class="profiler__cell-time">{formatMs(aggregate.selfMs)}<span class="profiler__cell-pct">{formatPercent(aggregate.selfMs, traceTotalMs)}</span></td>
                  <td class="profiler__cell-time">{formatMs(aggregate.totalMs)}<span class="profiler__cell-pct">{formatPercent(aggregate.totalMs, traceTotalMs)}</span></td>
                  <td>
                    <span class="profiler__activity">
                      {expandable ? (
                        <button
                          type="button"
                          class="profiler__caret"
                          aria-label={expanded ? `Collapse ${aggregate.kind}` : `Expand ${aggregate.kind}`}
                          onClick={event => {
                            event.stopPropagation()
                            onToggleKind(aggregate.kind)
                          }}
                        >
                          {expanded ? '▾' : '▸'}
                        </button>
                      ) : (
                        <span class="profiler__caret" />
                      )}
                      <span class="profiler__swatch" style={{ background: aggregate.color.fill, borderColor: aggregate.color.border }} />
                      <span class="profiler__kind">{aggregate.kind}</span>
                      {aggregate.variantInfo && <span class="profiler__variant">{aggregate.variantInfo}</span>}
                    </span>
                  </td>
                </tr>
                {children.map((unit, index) => (
                  <tr
                    key={`${aggregate.kind}::${index}`}
                    class={`profiler__row profiler__row--child${unit === selectedUnit ? ' profiler__row--selected' : ''}`}
                    onClick={() => onSelectUnit(unit)}
                    onMouseEnter={() => onHoverUnits([unit])}
                    onMouseLeave={onClearHover}
                  >
                    <td class="profiler__cell-time">{formatMs(selfDurationOf(unit))}<span class="profiler__cell-pct">{formatPercent(selfDurationOf(unit), traceTotalMs)}</span></td>
                    <td class="profiler__cell-time">{formatMs(unit.durationMs ?? 0)}<span class="profiler__cell-pct">{formatPercent(unit.durationMs ?? 0, traceTotalMs)}</span></td>
                    <td>
                      <span class="profiler__activity profiler__activity--child">{childRowLabel(unit)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            )
          })}
      </table>
    </div>
  )
}

// --- Profiler container ---

type BottomTab = 'summary' | 'bottomUp' | 'props'

const BOTTOM_TABS: readonly { readonly id: BottomTab; readonly label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'bottomUp', label: 'Bottom-Up' },
  { id: 'props', label: 'Props' },
]

interface ProfilerProps {
  readonly trace: TraceMessage | undefined
}

const BOTTOM_MIN_HEIGHT = 100
const BOTTOM_DEFAULT_HEIGHT = 185
const BOTTOM_MAX_HEIGHT_RATIO = 0.7

export default function Profiler({ trace }: ProfilerProps) {
  const [selectedUnit, setSelectedUnit] = useState<TraceUnitMessage | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<BottomTab>('summary')
  const [expandedKinds, setExpandedKinds] = useState<ReadonlySet<string>>(() => new Set())
  const [hoverUnits, setHoverUnits] = useState<ReadonlySet<TraceUnitMessage>>(EMPTY_UNITS)
  const [bottomHeight, setBottomHeight] = useState(BOTTOM_DEFAULT_HEIGHT)
  const profilerRef = useRef<HTMLDivElement>(null)
  const viewport = useHorizontalViewport(trace)

  useEffect(() => {
    setSelectedUnit(undefined)
    setActiveTab('summary')
    setExpandedKinds(new Set())
    setHoverUnits(EMPTY_UNITS)
  }, [trace])

  const allUnits = useMemo(() => (trace ? collectAllUnits(trace) : []), [trace])
  const aggregates = useMemo(() => (trace ? buildAggregates(trace) : []), [trace])
  const summarySegments = useMemo(() => {
    if (!trace) {
      return []
    }

    const scopeUnits = selectedUnit ? collectSubtree(selectedUnit) : allUnits
    const centreMs = selectedUnit ? selectedUnit.durationMs ?? 0 : trace.trace.durationMs

    return buildCategorySummary(scopeUnits, centreMs)
  }, [trace, selectedUnit, allUnits])

  if (!trace) {
    return <div class="empty-state">Select a trace to view details</div>
  }

  const summaryCentreMs = selectedUnit ? selectedUnit.durationMs ?? 0 : trace.trace.durationMs

  const handleBarSelect = (unit: TraceUnitMessage) => {
    if (unit === selectedUnit) {
      setSelectedUnit(undefined)
      setActiveTab('summary')

      return
    }

    setSelectedUnit(unit)
    setActiveTab('props')
  }

  const handleBackgroundClick = () => {
    setSelectedUnit(undefined)
    setActiveTab('summary')
  }

  const handleToggleKind = (kind: string) => {
    setExpandedKinds(previous => {
      const next = new Set(previous)

      if (next.has(kind)) {
        next.delete(kind)
      } else {
        next.add(kind)
      }

      return next
    })
  }

  const handleHoverUnits = (units: readonly TraceUnitMessage[]) => setHoverUnits(new Set(units))
  const handleClearHover = () => setHoverUnits(EMPTY_UNITS)

  const handleResizeStart = (event: MouseEvent) => {
    event.preventDefault()
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    const startY = event.clientY
    const startHeight = bottomHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const containerHeight = profilerRef.current?.getBoundingClientRect().height ?? 0
      // Dragging upward grows the pane, so subtract the downward delta.
      const nextHeight = startHeight - (moveEvent.clientY - startY)
      const maxHeight = containerHeight * BOTTOM_MAX_HEIGHT_RATIO

      setBottomHeight(Math.max(BOTTOM_MIN_HEIGHT, Math.min(maxHeight, nextHeight)))
    }

    const handleMouseUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div ref={profilerRef} class="profiler">
      <div class="profiler__toolbar">
        {viewport.isZoomed && (
          <button class="profiler__reset" onClick={viewport.resetZoom}>Reset zoom</button>
        )}
        <span class="profiler__spacer" />
        <span class="profiler__total">
          total <b>{formatMs(trace.trace.durationMs)}</b> · {trace.method} · {capitalize(trace.trace.outcome)}
        </span>
      </div>

      <Flamegraph
        trace={trace}
        viewport={viewport}
        selectedUnit={selectedUnit}
        hoverUnits={hoverUnits}
        onBarSelect={handleBarSelect}
        onBackgroundClick={handleBackgroundClick}
      />

      <div class="profiler__bottom" style={{ height: bottomHeight }}>
        <div class="profiler__resize-handle" onMouseDown={handleResizeStart} />
        <div class="profiler__bottom-tabs">
          {BOTTOM_TABS.map(tab => (
            <button
              key={tab.id}
              class={`tab${activeTab === tab.id ? ' tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'summary' && <SummaryPane segments={summarySegments} centreMs={summaryCentreMs} />}
        {activeTab === 'bottomUp' && (
          <BottomUpTable
            aggregates={aggregates}
            traceTotalMs={trace.trace.durationMs}
            selectedUnit={selectedUnit}
            expandedKinds={expandedKinds}
            onToggleKind={handleToggleKind}
            onSelectUnit={setSelectedUnit}
            onHoverUnits={handleHoverUnits}
            onClearHover={handleClearHover}
          />
        )}
        {activeTab === 'props' && (
          selectedUnit ? (
            <div class="profiler__props">
              <UnitDetail
                unit={selectedUnit}
                swatchColor={colorFor(categoryFor(selectedUnit.kind))}
                traceUnits={allUnits}
                onSelectUnit={setSelectedUnit}
              />
            </div>
          ) : (
            <div class="profiler__empty">Select a unit in the chart or Bottom-Up table</div>
          )
        )}
      </div>
    </div>
  )
}
