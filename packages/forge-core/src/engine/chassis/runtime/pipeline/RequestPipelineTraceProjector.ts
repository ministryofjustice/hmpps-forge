import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'
import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import { captureContextSnapshot, type ContextSnapshotData } from './contextSnapshot'
import type {
  RequestTrace,
  RequestTraceError,
  RequestTracePhase,
  RequestTraceReachabilityStep,
  RequestTraceRouteContext,
  RequestTraceUnit,
  RuntimeContextSnapshotTrace,
} from '../../contracts/runtime/trace.type'
import type TraceSpan from '../../tracing/TraceSpan'
import TraceSpanSerializer from '../../tracing/TraceSpanSerializer'
import type {
  ReachabilityEvaluation,
  ReachabilityNode,
} from '../../../concerns/reachability/contracts/reachabilityEvaluation.type'
import type { ForgeInstrumentation } from '../../tracing/ForgeTraceSinkDispatcher'
import type { RequestPipelineResult } from '../../contracts/runtime/requestPipelineOutput.type'
import type { MountedNode } from '../../registries/MountRegistry'
import type { NodeId } from '../../contracts/ast/ast.type'
import type { RouteTree, RouteTreeNode } from '../../../../framework/types/routeTree.type'

interface RequestTraceEmissionBase {
  readonly instrumentation: ForgeInstrumentation
  readonly snapshot: RequestSnapshot
  /** The `request.pipeline` root span the work executor produced. */
  readonly root: TraceSpan
  readonly node: MountedNode
  readonly routeTree: RouteTree | undefined
  readonly reachabilityEvaluation: ReachabilityEvaluation | undefined
}

export interface RequestTraceEmission extends RequestTraceEmissionBase {
  readonly result: RequestPipelineResult
}

export interface FailedRequestTraceEmission extends RequestTraceEmissionBase {
  readonly error: unknown
  readonly context: RuntimeContext
}

export default class RequestPipelineTraceProjector {
  private readonly serializer = new TraceSpanSerializer()

  emit(emission: RequestTraceEmission): void {
    const { instrumentation, snapshot, root, result, node, routeTree, reachabilityEvaluation } = emission

    if (!instrumentation.enabled) {
      return
    }

    const phases = this.project(root)

    if (phases.length === 0) {
      return
    }

    const outcome = this.traceOutcome(result)

    instrumentation.onRequestTrace({
      snapshot,
      trace: {
        outcome,
        ...this.traceTiming(root),
        ...this.resultDetail(result),
        ...this.reachabilityDetail(reachabilityEvaluation),
        phases,
      },
      route: this.traceRoute(node, routeTree),
    })
  }

  emitFailed(emission: FailedRequestTraceEmission): void {
    const { instrumentation, snapshot, root, error, context, node, routeTree, reachabilityEvaluation } = emission

    if (!instrumentation.enabled) {
      return
    }

    const phases = this.projectFailed(root, context)

    if (phases.length === 0) {
      return
    }

    instrumentation.onRequestTrace({
      snapshot,
      trace: {
        outcome: 'error',
        ...this.traceTiming(root),
        error: this.errorDetail(error),
        ...this.reachabilityDetail(reachabilityEvaluation),
        phases,
      },
      route: this.traceRoute(node, routeTree),
    })
  }

  private project(rootUnit: TraceSpan): RequestTracePhase[] {
    return rootUnit.children.map(phaseUnit => {
      const phase = this.phaseName(phaseUnit.kind)
      const units: RequestTraceUnit[] = phaseUnit.children.map(child => this.serializer.serialize(child))

      if (phaseUnit.completed) {
        units.push(this.toContextSnapshotUnit(phase, phaseUnit.completeFields as ContextSnapshotData))
      }

      return { phase, ...this.traceTiming(phaseUnit), units }
    })
  }

  projectFailed(rootUnit: TraceSpan, context: RuntimeContext): RequestTracePhase[] {
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
      reachabilityValidities: data.reachabilityValidities,
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
      const status = this.errorStatus(error)

      return { message: error.message, stack: error.stack, ...(status === undefined ? {} : { status }) }
    }

    return { message: String(error) }
  }

  private errorStatus(error: Error): number | undefined {
    const status = Reflect.get(error, 'status')

    if (typeof status === 'number') {
      return status
    }

    const statusCode = Reflect.get(error, 'statusCode')

    return typeof statusCode === 'number' ? statusCode : undefined
  }

  private reachabilityDetail(evaluation: ReachabilityEvaluation | undefined): Pick<RequestTrace, 'reachability'> {
    if (evaluation === undefined) {
      return {}
    }

    // The trace is an immutable buffered record; the live evaluation's node arrays are shared and
    // mutated in place by the graph builder, so copy every array rather than alias it.
    return {
      reachability: {
        currentStepId: evaluation.currentStepId,
        steps: evaluation.steps.map(step => this.reachabilityStep(step)),
        defaultEntryRouteTemplatePath: evaluation.defaultEntryRouteTemplatePath,
        frontierRouteTemplatePath: evaluation.frontierRouteTemplatePath,
        canonicalPathRouteTemplatePaths: [...evaluation.canonicalPathRouteTemplatePaths],
        progressExists: evaluation.progressExists,
        resumeActive: evaluation.resumeActive,
        resumeOutcome: evaluation.resumeOutcome,
        unreachableRedirect: evaluation.unreachableRedirect,
      },
    }
  }

  private reachabilityStep(step: ReachabilityNode): RequestTraceReachabilityStep {
    return {
      stepId: step.stepId,
      routeTemplatePath: step.routeTemplatePath,
      code: step.code,
      declarationIndex: step.declarationIndex,
      isEntryPoint: step.isEntryPoint,
      isConditionalEntry: step.isConditionalEntry,
      hasValidation: step.hasValidation,
      isReachable: step.isReachable,
      isValid: step.isValid,
      forwardRouteTemplatePaths: [...step.forwardRouteTemplatePaths],
      ...(step.declaredForwardRouteTemplatePaths
        ? { declaredForwardRouteTemplatePaths: [...step.declaredForwardRouteTemplatePaths] }
        : {}),
      predecessorRouteTemplatePaths: [...step.predecessorRouteTemplatePaths],
      tieBreakerPriority: step.tieBreakerPriority,
    }
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

  private traceTiming(traceSpan: TraceSpan): Pick<RequestTrace, 'startedAtMs' | 'completedAtMs' | 'durationMs'> {
    return {
      startedAtMs: traceSpan.startedAtMs,
      completedAtMs: traceSpan.completedAtMs,
      durationMs: traceSpan.durationMs,
    }
  }

  private phaseName(kind: string): string {
    const prefix = 'request.'

    return kind.startsWith(prefix) ? kind.slice(prefix.length) : kind
  }
}
