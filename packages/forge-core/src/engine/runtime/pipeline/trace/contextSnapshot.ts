import type { ContextSnapshotTraceUnit } from '../../../contracts/trace/requestTrace.type'
import type { PipelineState } from '../types'

const MAX_CLONE_DEPTH = 12

/**
 * Records a `context-snapshot` unit into the state's trace recorder: a tolerant
 * deep copy of the whole evaluation context — request inputs, answer histories,
 * data, validation, reachability, cleardown codes, and response mutations — at
 * the labelled point. No-ops when the request is untraced. Later phases mutate
 * the context in place, so every snapshot copies eagerly; non-serializable
 * values are replaced with labels rather than throwing.
 */
export function recordContextSnapshot(
  state: Pick<PipelineState, 'trace' | 'context' | 'request' | 'responseBindings'>,
  point: string,
): void {
  if (!state.trace) {
    return
  }

  const { request } = state
  const { global } = state.context

  state.trace.record({
    kind: 'context-snapshot',
    point,
    request: {
      params: cloneRecord(request.getParams()),
      query: cloneRecord(request.getAllQuery()),
      post: cloneRecord(request.getAllPost()),
      headers: cloneRecord(request.getAllHeaders()),
      cookies: cloneRecord(request.getAllCookies()),
      session: cloneTolerant(request.getSession(), new Set(), 0),
      state: cloneRecord(request.getAllState()),
    },
    answers: cloneRecord(global.answers),
    data: cloneRecord(global.data),
    validation: cloneTolerant(global.validation, new Set(), 0),
    reachability: cloneTolerant(global.reachability, new Set(), 0),
    fieldsToClear: global.fieldsToClear ? [...global.fieldsToClear] : undefined,
    response: {
      headers: cloneRecord(Object.fromEntries(state.responseBindings.getAllHeaders())),
      cookies: cloneRecord(Object.fromEntries(state.responseBindings.getAllCookies())),
    },
  } satisfies ContextSnapshotTraceUnit)
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  const cloned = cloneTolerant(value, new Set(), 0)

  return isRecord(cloned) ? cloned : {}
}

/**
 * Deep-copies a value, substituting labels for anything that cannot be
 * serialized: functions, circular references, values past the depth cap, and
 * properties whose getters throw. Objects are cloned by their own enumerable
 * string-keyed properties regardless of prototype, so class instances (e.g.
 * an Express session) serialize as plain data.
 */
function cloneTolerant(value: unknown, seen: Set<object>, depth: number): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`
  }

  if (typeof value === 'bigint') {
    return `${value}n`
  }

  if (typeof value !== 'object') {
    return value
  }

  if (seen.has(value)) {
    return '[Circular]'
  }

  if (depth >= MAX_CLONE_DEPTH) {
    return '[MaxDepth]'
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  seen.add(value)

  const cloned = cloneObject(value, seen, depth)

  seen.delete(value)

  return cloned
}

function cloneObject(value: object, seen: Set<object>, depth: number): unknown {
  if (Array.isArray(value)) {
    return value.map(item => cloneTolerant(item, seen, depth + 1))
  }

  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([key, entry]) => [String(key), cloneTolerant(entry, seen, depth + 1)]),
    )
  }

  if (value instanceof Set) {
    return [...value.values()].map(item => cloneTolerant(item, seen, depth + 1))
  }

  const cloned: Record<string, unknown> = {}

  Object.keys(value).forEach(key => {
    try {
      cloned[key] = cloneTolerant((value as Record<string, unknown>)[key], seen, depth + 1)
    } catch {
      cloned[key] = `[Unserializable: ${value.constructor?.name ?? typeof value}]`
    }
  })

  return cloned
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
