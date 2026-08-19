import { FORGE_WORK } from '../contracts/work/work.type'
import type { CompletedWork, WorkGroup, WorkHandler, WorkInstrumentation, WorkTask } from '../contracts/work/work.type'
import type { WorkOutputOf } from '../contracts/work/workOutput.type'

export function createWorkTask<K extends string, TProps>(
  key: string,
  handler: WorkHandler<K, TProps>,
  props: TProps,
  instrumentation?: WorkInstrumentation<TProps, WorkOutputOf<K>>,
): WorkTask<K, TProps> {
  return { $$typeof: FORGE_WORK, key, handler, props, instrumentation }
}

/**
 * Reads the output of the first completed child of a given kind. The kind keys the
 * registry, so the returned type is exactly that kind's output — the caller never
 * re-proves the shape.
 */
export function singleChildOutput<K extends string>(
  children: readonly CompletedWork[],
  kind: K,
): WorkOutputOf<K> | undefined {
  return children.find(child => child.kind === kind)?.output as WorkOutputOf<K> | undefined
}

/**
 * Reads the outputs of every completed child of a given kind, each typed as that
 * kind's registry output. Used by the fan-out parents (resolve blocks, step
 * validation, validities).
 */
export function childOutputs<K extends string>(
  children: readonly CompletedWork[],
  kind: K,
): readonly WorkOutputOf<K>[] {
  return children.filter(child => child.kind === kind).map(child => child.output as WorkOutputOf<K>)
}

/**
 * Finds the completed child produced by a specific task, matching on the task's
 * key and kind. Returns the completed work so callers can both test existence and
 * read the typed output via `?.output`.
 */
export function findChildByTask<K extends string>(
  children: readonly CompletedWork[],
  task: WorkTask<K>,
): CompletedWork<WorkOutputOf<K>> | undefined {
  return children.find(child => child.key === task.key && child.kind === task.handler.kind) as
    | CompletedWork<WorkOutputOf<K>>
    | undefined
}

/**
 * Narrows an untrusted value to a work task of a specific kind. Used to validate
 * the task a compiled function returned before running it as child work.
 */
export function isWorkTaskOfKind(value: unknown, kind: string): value is WorkTask {
  return isWorkTask(value) && value.handler.kind === kind
}

/**
 * Wraps a single task as a phase's child work: one sequential, reduce-all group.
 * The return is the `WorkBegin` groups-arm shape so it assigns to every phase's
 * kind-specific `WorkBegin`.
 */
export function singleTaskGroup(task: WorkTask): { readonly groups: readonly WorkGroup[] } {
  return { groups: [{ mode: 'sequential', children: [task] }] }
}

/**
 * True when a hook stage produced a terminal result. Reads the `status` field
 * structurally so the work primitives stay free of the hook-stage type.
 */
export function isTerminalStage(output: unknown): boolean {
  return typeof output === 'object' &&
    output !== null &&
    'status' in output &&
    (output as { status: unknown }).status === 'terminal'
}

/**
 * Returns the result carried by the first terminal hook stage, or undefined when
 * every stage continued. Lets a hook's `complete` fold its stage list in one pass.
 */
export function findTerminalStage<TResult>(children: readonly CompletedWork[]): TResult | undefined {
  const terminal = children.find(child => isTerminalStage(child.output))

  return terminal === undefined ? undefined : (terminal.output as { result: TResult }).result
}

export function isWorkTask(value: unknown): value is WorkTask {
  if (value === undefined || value === null || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<WorkTask>

  return candidate.$$typeof === FORGE_WORK &&
    typeof candidate.key === 'string' &&
    isWorkHandler(candidate.handler) &&
    'props' in candidate
}

function isWorkHandler(value: unknown): value is WorkHandler {
  if (value === undefined || value === null || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<WorkHandler>

  return typeof candidate.kind === 'string' && typeof candidate.begin === 'function'
}
