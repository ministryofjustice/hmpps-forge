import WorkContext from './WorkContext'
import WorkExecutionError from './WorkExecutionError'
import TraceSpan from '../../../diagnostics/tracing/TraceSpan'
import type { TraceSpanFields } from '../../../diagnostics/tracing/traceSpan.type'
import type { CompletedWork, WorkGroup, WorkTask } from '../../../contracts/runtime/work.type'
import type { WorkOutputOf } from '../../../contracts/runtime/workOutput.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

type FirstMatchWorkGroup = Extract<WorkGroup, { readonly mode: 'first-match' }>
type InstrumentedWorkTask<TWorkKind extends string> = WorkTask<TWorkKind> & {
  readonly instrumentation: NonNullable<WorkTask<TWorkKind>['instrumentation']>
}

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
    const traceSpan = this.createTraceSpan(task, ctx)

    return this.runUnit(task, ctx, traceSpan)
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

  private createTraceSpan(task: WorkTask, ctx: WorkContext): TraceSpan {
    const parentTraceSpan = ctx.work

    if (parentTraceSpan !== undefined && !(parentTraceSpan instanceof TraceSpan)) {
      throw new ForgeInternalError('Work context parent must be a TraceSpan to nest in the trace tree')
    }

    const traceSpan = new TraceSpan(task.key, task.handler.kind, parentTraceSpan)

    parentTraceSpan?.addChild(traceSpan)

    return traceSpan
  }

  private async runUnit<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
    traceSpan: TraceSpan,
  ): Promise<WorkExecutionResult<TWorkKind>> {
    const workCtx = ctx.withWork(traceSpan, task.props)
    const traceMetadataAtStart = this.resolveTraceMetadataAtStart(task, workCtx)

    traceSpan.recordTraceMetadataAtStart(traceMetadataAtStart)

    // Measure only the synchronous span of the handler calls: awaiting across a suspension
    // would fold in siblings' interleaved work, which is exactly the queue-wait smear we drop.
    const beginStartedAtMs = performance.now()
    const beginResult = task.handler.begin(workCtx)
    const beginCompletedAtMs = performance.now()

    traceSpan.addSelfTime(beginCompletedAtMs - beginStartedAtMs)
    traceSpan.recordExecutionSlice(beginStartedAtMs, beginCompletedAtMs)

    const begin = await beginResult
    const children: CompletedWork[] = []

    for (const group of begin.groups ?? []) {
      const completedGroup = await this.executeGroup(group, workCtx)

      children.push(...completedGroup)
    }

    const completeStartedAtMs = performance.now()
    const completeResult = this.completeWork(task, workCtx, children, begin.output)
    const completeCompletedAtMs = performance.now()

    traceSpan.addSelfTime(completeCompletedAtMs - completeStartedAtMs)
    traceSpan.recordExecutionSlice(completeStartedAtMs, completeCompletedAtMs)

    const output = await completeResult
    const traceMetadataAtFinish = this.resolveTraceMetadataAtFinish(task, workCtx, output)

    traceSpan.recordTraceMetadataAtFinish(traceMetadataAtFinish)
    traceSpan.complete(output)

    return {
      key: task.key,
      kind: task.handler.kind,
      output,
      children,
    }
  }

  private async executeGroup(group: WorkGroup, ctx: WorkContext): Promise<CompletedWork[]> {
    switch (group.mode) {
      case 'concurrent':
        return this.executeConcurrently(group, ctx)
      case 'sequential':
        return this.executeSequentially(group, ctx)
      case 'first-match':
        return this.executeFirstMatch(group, ctx)
      default:
        return assertNever(group)
    }
  }

  private async executeConcurrently(group: WorkGroup, ctx: WorkContext): Promise<CompletedWork[]> {
    return Promise.all(group.children.map(child => this.execute(child, ctx)))
  }

  private async executeSequentially(group: WorkGroup, ctx: WorkContext): Promise<CompletedWork[]> {
    const completedChildren: CompletedWork[] = []

    for (const child of group.children) {
      completedChildren.push(await this.execute(child, ctx))
    }

    return completedChildren
  }

  private async executeFirstMatch(group: FirstMatchWorkGroup, ctx: WorkContext): Promise<CompletedWork[]> {
    const completedChildren: CompletedWork[] = []

    for (const child of group.children) {
      const completedChild = await this.execute(child, ctx)

      completedChildren.push(completedChild)

      if (group.matches(completedChild)) {
        break
      }
    }

    return completedChildren
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

  private async completeWork<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
    children: CompletedWork[],
    beginOutput: unknown,
  ): Promise<WorkOutputOf<TWorkKind>> {
    if (task.handler.complete === undefined) {
      return beginOutput as WorkOutputOf<TWorkKind>
    }

    return task.handler.complete(ctx, children)
  }
}

function assertNever(value: never): never {
  throw new ForgeInternalError(`Unhandled work group mode: ${JSON.stringify(value)}`)
}

function isInstrumentedWorkTask<TWorkKind extends string>(
  task: WorkTask<TWorkKind>,
): task is InstrumentedWorkTask<TWorkKind> {
  return task.instrumentation !== undefined
}
