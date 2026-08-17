import WorkContext from './WorkContext'
import WorkExecutionError from './WorkExecutionError'
import TraceSpan from '../tracing/TraceSpan'
import type { TraceSpanFields } from '../tracing/traceSpan.type'
import type { CompletedWork, WorkGroup, WorkTask } from '../contracts/work/work.type'
import type { WorkOutputOf } from '../contracts/work/workOutput.type'
import ForgeInternalError from '../errors/ForgeInternalError'

type InOrderWorkGroup = Extract<WorkGroup, { readonly mode: 'sequential' | 'first-match' }>
type InstrumentedWorkTask<TWorkKind extends string> = WorkTask<TWorkKind> & {
  readonly instrumentation: NonNullable<WorkTask<TWorkKind>['instrumentation']>
}

/**
 * A plain value while every step has stayed synchronous, a promise from the moment
 * any handler suspends. One executor recursion serves both the async request
 * pipeline and fully-synchronous compilation trees without forking the code path.
 */
type MaybeAsync<TValue> = TValue | Promise<TValue>

export type WorkExecutionResult<TWorkKind extends string> = CompletedWork<WorkOutputOf<TWorkKind>>

export interface WorkExecutionResultWithUnit<TWorkKind extends string> {
  readonly completedWork: WorkExecutionResult<TWorkKind>
  readonly traceSpan: TraceSpan
}

export default class WorkExecutor {
  constructor(private readonly traceEnabled: boolean = true) {}

  async execute<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
  ): Promise<WorkExecutionResult<TWorkKind>> {
    return this.runWithSpan(task, ctx)
  }

  async executeWithUnit<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
  ): Promise<WorkExecutionResultWithUnit<TWorkKind>> {
    const traceSpan = this.createTraceSpan(task, ctx)

    try {
      const completedWork = await this.runUnit(task, ctx, traceSpan)

      return { completedWork, traceSpan }
    } catch (error) {
      throw new WorkExecutionError(error, traceSpan)
    }
  }

  /**
   * Runs a task tree that must never suspend, staying off the microtask queue
   * entirely. Compilation executes through this: its handlers are all synchronous,
   * so a promise from any of them is a programming error, not an outcome.
   */
  executeSync<TWorkKind extends string>(task: WorkTask<TWorkKind>, ctx: WorkContext): WorkExecutionResult<TWorkKind> {
    return requireSyncResult(this.runWithSpan(task, ctx), task)
  }

  executeSyncWithUnit<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
  ): WorkExecutionResultWithUnit<TWorkKind> {
    const traceSpan = this.createTraceSpan(task, ctx)

    try {
      const completedWork = requireSyncResult(this.runUnit(task, ctx, traceSpan), task)

      return { completedWork, traceSpan }
    } catch (error) {
      throw new WorkExecutionError(error, traceSpan)
    }
  }

  private createTraceSpan(task: WorkTask, ctx: WorkContext): TraceSpan {
    const parentTraceSpan = ctx.work

    if (parentTraceSpan !== undefined && !(parentTraceSpan instanceof TraceSpan)) {
      throw new ForgeInternalError('Work context parent must be a TraceSpan to nest in the trace tree')
    }

    const traceSpan = new TraceSpan(task.key, task.handler.kind, parentTraceSpan)

    parentTraceSpan?.addChild(traceSpan)

    return traceSpan
  }

  private runWithSpan<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
  ): MaybeAsync<WorkExecutionResult<TWorkKind>> {
    return this.runUnit(task, ctx, this.createTraceSpan(task, ctx))
  }

  private runUnit<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
    traceSpan: TraceSpan,
  ): MaybeAsync<WorkExecutionResult<TWorkKind>> {
    const workCtx = ctx.withWork(traceSpan, task.props)

    traceSpan.recordTraceMetadataAtStart(this.resolveTraceMetadataAtStart(task, workCtx))

    // Measure only the synchronous span of the handler calls: awaiting across a suspension
    // would fold in siblings' interleaved work, which is exactly the queue-wait smear we drop.
    const beginStartedAtMs = performance.now()
    const beginResult = task.handler.begin(workCtx)
    const beginCompletedAtMs = performance.now()

    traceSpan.addSelfTime(beginCompletedAtMs - beginStartedAtMs)
    traceSpan.recordExecutionSlice(beginStartedAtMs, beginCompletedAtMs)

    return chain(beginResult, begin =>
      chain(this.executeGroups(begin.groups ?? [], workCtx), children => {
        const completeStartedAtMs = performance.now()
        const completeResult = this.completeWork(task, workCtx, children, begin.output)
        const completeCompletedAtMs = performance.now()

        traceSpan.addSelfTime(completeCompletedAtMs - completeStartedAtMs)
        traceSpan.recordExecutionSlice(completeStartedAtMs, completeCompletedAtMs)

        return chain(completeResult, output => {
          traceSpan.recordTraceMetadataAtFinish(this.resolveTraceMetadataAtFinish(task, workCtx, output))
          traceSpan.complete(output)

          return {
            key: task.key,
            kind: task.handler.kind,
            output,
            children,
          }
        })
      }),
    )
  }

  private executeGroups(groups: readonly WorkGroup[], ctx: WorkContext): MaybeAsync<CompletedWork[]> {
    return groups.reduce<MaybeAsync<CompletedWork[]>>(
      (accumulated, group) =>
        chain(accumulated, children =>
          chain(this.executeGroup(group, ctx), groupChildren => [...children, ...groupChildren]),
        ),
      [],
    )
  }

  private executeGroup(group: WorkGroup, ctx: WorkContext): MaybeAsync<CompletedWork[]> {
    switch (group.mode) {
      case 'concurrent':
        return this.executeConcurrently(group, ctx)
      case 'sequential':
      case 'first-match':
        return this.executeInOrder(group, ctx)
      default:
        return assertNever(group)
    }
  }

  private executeConcurrently(group: WorkGroup, ctx: WorkContext): MaybeAsync<CompletedWork[]> {
    const results = group.children.map(child => this.runWithSpan(child, ctx))

    return results.some(result => result instanceof Promise) ? Promise.all(results) : (results as CompletedWork[])
  }

  private executeInOrder(group: InOrderWorkGroup, ctx: WorkContext): MaybeAsync<CompletedWork[]> {
    const stopWhen = group.mode === 'first-match' ? group.matches : undefined
    const completedChildren: CompletedWork[] = []

    const runFrom = (index: number): MaybeAsync<CompletedWork[]> => {
      if (index >= group.children.length) {
        return completedChildren
      }

      return chain(this.runWithSpan(group.children[index], ctx), completedChild => {
        completedChildren.push(completedChild)

        return stopWhen?.(completedChild) === true ? completedChildren : runFrom(index + 1)
      })
    }

    return runFrom(0)
  }

  private resolveTraceMetadataAtStart<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
  ): TraceSpanFields | undefined {
    if (!this.traceEnabled || !isInstrumentedWorkTask(task)) {
      return undefined
    }

    return task.instrumentation.resolveTraceMetadataAtStart(ctx)
  }

  private resolveTraceMetadataAtFinish<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
    output: WorkOutputOf<TWorkKind>,
  ): TraceSpanFields | undefined {
    if (!this.traceEnabled || !isInstrumentedWorkTask(task)) {
      return undefined
    }

    return task.instrumentation.resolveTraceMetadataAtFinish(ctx, output)
  }

  private completeWork<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
    children: CompletedWork[],
    beginOutput: unknown,
  ): MaybeAsync<WorkOutputOf<TWorkKind>> {
    if (task.handler.complete === undefined) {
      return beginOutput as WorkOutputOf<TWorkKind>
    }

    return task.handler.complete(ctx, children)
  }
}

function chain<TIn, TOut>(value: MaybeAsync<TIn>, next: (value: TIn) => MaybeAsync<TOut>): MaybeAsync<TOut> {
  return value instanceof Promise ? value.then(next) : next(value)
}

function requireSyncResult<TValue>(result: MaybeAsync<TValue>, task: WorkTask): TValue {
  if (result instanceof Promise) {
    // The stray asynchronous work is already in flight; silence its settlement so it
    // cannot fire an unhandled rejection on top of the error thrown here.
    result.catch(() => undefined)
    throw new ForgeInternalError(`Synchronous execution encountered asynchronous work under task "${task.key}"`)
  }

  return result
}

function assertNever(value: never): never {
  throw new ForgeInternalError(`Unhandled work group mode: ${JSON.stringify(value)}`)
}

function isInstrumentedWorkTask<TWorkKind extends string>(
  task: WorkTask<TWorkKind>,
): task is InstrumentedWorkTask<TWorkKind> {
  return task.instrumentation !== undefined
}
