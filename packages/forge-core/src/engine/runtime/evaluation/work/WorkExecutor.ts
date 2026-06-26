import WorkContext from './WorkContext'
import WorkUnit from './WorkUnit'
import WorkExecutionError from './WorkExecutionError'
import type { CompletedWork, WorkGroup, WorkTask, WorkUnitFields } from '../../../contracts/runtime/work.type'
import type { WorkOutputOf } from '../../../contracts/runtime/workOutput.type'

type FirstMatchWorkGroup = Extract<WorkGroup, { readonly mode: 'first-match' }>
type InstrumentedWorkTask<TWorkKind extends string> = WorkTask<TWorkKind> & {
  readonly instrumentation: NonNullable<WorkTask<TWorkKind>['instrumentation']>
}

export type WorkExecutionResult<TWorkKind extends string> = CompletedWork<WorkOutputOf<TWorkKind>>

export interface WorkExecutionResultWithUnit<TWorkKind extends string> {
  readonly completedWork: WorkExecutionResult<TWorkKind>
  readonly workUnit: WorkUnit
}

export default class WorkExecutor {
  constructor(private readonly traceEnabled: boolean = true) {}

  async execute<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
  ): Promise<WorkExecutionResult<TWorkKind>> {
    const workUnit = this.createWorkUnit(task, ctx)

    return this.runUnit(task, ctx, workUnit)
  }

  async executeWithUnit<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
  ): Promise<WorkExecutionResultWithUnit<TWorkKind>> {
    const workUnit = this.createWorkUnit(task, ctx)

    try {
      const completedWork = await this.runUnit(task, ctx, workUnit)

      return { completedWork, workUnit }
    } catch (error) {
      throw new WorkExecutionError(error, workUnit)
    }
  }

  private createWorkUnit(task: WorkTask, ctx: WorkContext): WorkUnit {
    const parentWorkUnit = ctx.work

    if (parentWorkUnit !== undefined && !(parentWorkUnit instanceof WorkUnit)) {
      throw new Error('[Forge] Work context parent must be a WorkUnit to nest in the trace tree')
    }

    const workUnit = new WorkUnit(task.key, task.handler.kind, parentWorkUnit)

    parentWorkUnit?.addChild(workUnit)

    return workUnit
  }

  private async runUnit<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
    workUnit: WorkUnit,
  ): Promise<WorkExecutionResult<TWorkKind>> {
    const workCtx = ctx.withWork(workUnit, task.props)
    const traceMetadataAtStart = this.resolveTraceMetadataAtStart(task, workCtx)

    workUnit.recordTraceMetadataAtStart(traceMetadataAtStart)

    const begin = await task.handler.begin(workCtx)
    const children: CompletedWork[] = []

    for (const group of begin.groups ?? []) {
      const completedGroup = await this.executeGroup(group, workCtx)

      children.push(...completedGroup)
    }

    const output = await this.completeWork(task, workCtx, children, begin.output)
    const traceMetadataAtFinish = this.resolveTraceMetadataAtFinish(task, workCtx, output)

    workUnit.recordTraceMetadataAtFinish(traceMetadataAtFinish)
    workUnit.complete(output)

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
  ): WorkUnitFields | undefined {
    if (!this.traceEnabled || !isInstrumentedWorkTask(task)) {
      return undefined
    }

    return task.instrumentation.resolveTraceMetadataAtStart(ctx)
  }

  private resolveTraceMetadataAtFinish<TWorkKind extends string>(
    task: WorkTask<TWorkKind>,
    ctx: WorkContext,
    output: WorkOutputOf<TWorkKind>,
  ): WorkUnitFields | undefined {
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
  throw new Error(`[Forge] Unhandled work group mode: ${JSON.stringify(value)}`)
}

function isInstrumentedWorkTask<TWorkKind extends string>(
  task: WorkTask<TWorkKind>,
): task is InstrumentedWorkTask<TWorkKind> {
  return task.instrumentation !== undefined
}
