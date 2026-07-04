import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'
import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import { captureContextSnapshot, type ContextSnapshotData } from '../work/tracing/contextSnapshot'
import type {
  RequestTrace,
  RequestTraceError,
  RequestTracePhase,
  RequestTraceRouteContext,
  RequestTraceUnit,
  RuntimeContextSnapshotTrace,
} from '../../../contracts/runtime/trace.type'
import type WorkUnit from '../work/WorkUnit'
import WorkUnitTraceSerializer from '../work/tracing/WorkUnitTraceSerializer'
import type { ForgeInstrumentation } from '../../../diagnostics/ForgeTraceSinkDispatcher'
import type { RequestPipelineResult } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { MountedNode } from '../../../registries/MountRegistry'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { RouteTree, RouteTreeNode } from '../../../../framework/rendering/types'

export default class RequestPipelineTraceProjector {
  private readonly serializer = new WorkUnitTraceSerializer()

  emitTrace(
    snapshot: RequestSnapshot,
    instrumentation: ForgeInstrumentation,
    result: RequestPipelineResult,
    rootWorkUnit: WorkUnit,
    node: MountedNode,
    routeTree: RouteTree | undefined,
  ): void {
    if (!instrumentation.enabled) {
      return
    }

    const phases = this.project(rootWorkUnit)

    if (phases.length === 0) {
      return
    }

    const outcome = this.traceOutcome(result)

    instrumentation.onRequestTrace({
      snapshot,
      trace: { outcome, ...this.traceTiming(rootWorkUnit), ...this.resultDetail(result), phases },
      route: this.traceRoute(node, routeTree),
    })
  }

  emitFailedTrace(
    snapshot: RequestSnapshot,
    instrumentation: ForgeInstrumentation,
    error: unknown,
    rootWorkUnit: WorkUnit,
    context: RuntimeContext,
    node: MountedNode,
    routeTree: RouteTree | undefined,
  ): void {
    if (!instrumentation.enabled) {
      return
    }

    const phases = this.projectFailed(rootWorkUnit, context)

    if (phases.length === 0) {
      return
    }

    instrumentation.onRequestTrace({
      snapshot,
      trace: { outcome: 'error', ...this.traceTiming(rootWorkUnit), error: this.errorDetail(error), phases },
      route: this.traceRoute(node, routeTree),
    })
  }

  private project(rootUnit: WorkUnit): RequestTracePhase[] {
    return rootUnit.children.map(phaseUnit => {
      const phase = this.phaseName(phaseUnit.kind)
      const units: RequestTraceUnit[] = phaseUnit.children.map(child => this.serializer.serialize(child))

      if (phaseUnit.completed) {
        units.push(this.toContextSnapshotUnit(phase, phaseUnit.completeFields as ContextSnapshotData))
      }

      return { phase, ...this.traceTiming(phaseUnit), units }
    })
  }

  projectFailed(rootUnit: WorkUnit, context: RuntimeContext): RequestTracePhase[] {
    const phases = this.project(rootUnit)
    const failedIndex = rootUnit.children.length - 1
    const failedPhase = phases[failedIndex]

    if (failedPhase === undefined || failedPhase.units.some(unit => unit.kind === 'context-snapshot')) {
      return phases
    }

    phases[failedIndex] = {
      ...failedPhase,
      units: [...failedPhase.units, this.toContextSnapshotUnit(failedPhase.phase, captureContextSnapshot(context))],
    }

    return phases
  }

  private toContextSnapshotUnit(phase: string, data: ContextSnapshotData): RuntimeContextSnapshotTrace {
    return {
      key: `after-${phase}`,
      kind: 'context-snapshot',
      beginFields: {},
      completeFields: {},
      completed: true,
      children: [],
      answers: data.answers,
      data: data.data,
      stepValidities: data.stepValidities,
      reachability: data.reachability,
    }
  }

  private traceOutcome(result: RequestPipelineResult): 'render' | 'redirect' | 'error' {
    if (result.kind === 'redirect') {
      return 'redirect'
    }

    return result.kind
  }

  private resultDetail(result: RequestPipelineResult): Pick<RequestTrace, 'redirect' | 'error'> {
    if (result.kind === 'redirect') {
      return { redirect: { target: result.target } }
    }

    if (result.kind === 'error') {
      return { error: { status: result.status, message: result.message } }
    }

    return {}
  }

  private errorDetail(error: unknown): RequestTraceError {
    if (error instanceof Error) {
      return { message: error.message, stack: error.stack }
    }

    return { message: String(error) }
  }

  private traceRoute(node: MountedNode, routeTree: RouteTree | undefined): RequestTraceRouteContext {
    const activeBranch = routeTree ? this.collectActiveBranch(routeTree) : []

    return {
      journeyCode: node.journeyCode,
      routeTemplatePath: node.templatePath,
      journeyTitle: this.journeyTitle(activeBranch),
      stepTitle: this.stepTitle(activeBranch, node.nodeId),
    }
  }

  private journeyTitle(activeBranch: readonly RouteTreeNode[]): string | undefined {
    return activeBranch.find(node => node.route?.kind === 'journey')?.route?.title
  }

  private stepTitle(activeBranch: readonly RouteTreeNode[], nodeId: NodeId): string | undefined {
    const matched = activeBranch.find(node => node.route?.nodeId === nodeId)

    if (matched?.route?.title !== undefined) {
      return matched.route.title
    }

    return [...activeBranch].reverse().find(node => node.route !== undefined)?.route?.title
  }

  private collectActiveBranch(nodes: readonly RouteTreeNode[]): RouteTreeNode[] {
    const active = nodes.find(node => node.active)

    if (active === undefined) {
      return []
    }

    return [active, ...this.collectActiveBranch(active.children)]
  }

  private traceTiming(workUnit: WorkUnit): Pick<RequestTrace, 'startedAtMs' | 'completedAtMs' | 'durationMs'> {
    return {
      startedAtMs: workUnit.startedAtMs,
      completedAtMs: workUnit.completedAtMs,
      durationMs: workUnit.durationMs,
    }
  }

  private phaseName(kind: string): string {
    const prefix = 'request.'

    return kind.startsWith(prefix) ? kind.slice(prefix.length) : kind
  }
}
