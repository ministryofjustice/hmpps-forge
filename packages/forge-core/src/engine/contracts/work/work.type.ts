import type { TraceSpanFields, TraceSpanReference } from '../../tracing/traceSpan.type'
import type { WorkOutputOf } from './workOutput.type'

export const FORGE_WORK = Symbol.for('forge.work')

export interface WorkContextContract<TStageState = unknown, TProps = unknown> {
  readonly state: TStageState
  readonly props: TProps
  readonly work?: TraceSpanReference

  withWork(work: TraceSpanReference, props: TProps): WorkContextContract<TStageState, TProps>

  // Lets a work task drop its own trace unit (a no-op'd, unselected hook branch).
  // Optional because trace omission is best-effort and not every context records work.
  omitFromTrace?(): void
}

export interface WorkInstrumentation<TProps = unknown, TOutput = unknown> {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<unknown, TProps>): TraceSpanFields | undefined

  resolveTraceMetadataAtFinish(ctx: WorkContextContract<unknown, TProps>, output: TOutput): TraceSpanFields | undefined
}

export interface WorkHandler<K extends string = string, TProps = unknown> {
  readonly kind: K

  begin(ctx: WorkContextContract<unknown, TProps>): WorkBegin<K> | Promise<WorkBegin<K>>

  complete?(
    ctx: WorkContextContract<unknown, TProps>,
    children: readonly CompletedWork[],
  ): WorkOutputOf<K> | Promise<WorkOutputOf<K>>
}

export interface WorkTask<K extends string = string, TProps = unknown> {
  readonly $$typeof: typeof FORGE_WORK
  readonly key: string
  readonly handler: WorkHandler<K, TProps>
  readonly props: TProps
  readonly instrumentation?: WorkInstrumentation<TProps, WorkOutputOf<K>>
}

export type WorkBegin<K extends string = string> =
  | { readonly output: WorkOutputOf<K>; readonly groups?: never }
  | { readonly groups: readonly WorkGroup[]; readonly output?: never }

export interface CompletedWork<TOutput = unknown> {
  readonly key: string
  readonly kind: string
  readonly output: TOutput
  readonly children: readonly CompletedWork[]
}

export type WorkGroup =
  | { readonly mode: 'sequential'; readonly children: readonly WorkTask[] }
  | { readonly mode: 'concurrent'; readonly children: readonly WorkTask[] }
  | {
      readonly mode: 'first-match'
      readonly children: readonly WorkTask[]
      readonly matches: (work: CompletedWork) => boolean
    }
