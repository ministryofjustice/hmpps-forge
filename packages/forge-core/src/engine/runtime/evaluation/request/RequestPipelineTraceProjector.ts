import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'
import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import { captureContextSnapshot, type ContextSnapshotData } from '../work/tracing/contextSnapshot'
import type {
  RequestTracePhase,
  RequestTraceUnit,
  RuntimeContextSnapshotTrace,
} from '../../../contracts/runtime/trace.type'
import type WorkUnit from '../work/WorkUnit'
import WorkUnitTraceSerializer from '../work/tracing/WorkUnitTraceSerializer'
import type { ForgeInstrumentation } from '../../../diagnostics/ForgeTraceSinkDispatcher'
import type { RequestPipelineResult } from '../../../contracts/runtime/RequestExecutionContext.type'

export default class RequestPipelineTraceProjector {
  private readonly serializer = new WorkUnitTraceSerializer()

  emitTrace(
    snapshot: RequestSnapshot,
    instrumentation: ForgeInstrumentation,
    result: RequestPipelineResult,
    rootWorkUnit: WorkUnit,
  ): void {
    if (!instrumentation.enabled) {
      return
    }

    const phases = this.project(rootWorkUnit)

    if (phases.length === 0) {
      return
    }

    const outcome = this.traceOutcome(result)

    instrumentation.onRequestTrace({ snapshot, trace: { outcome, phases } })
  }

  emitFailedTrace(
    snapshot: RequestSnapshot,
    instrumentation: ForgeInstrumentation,
    rootWorkUnit: WorkUnit,
    context: RuntimeContext,
  ): void {
    if (!instrumentation.enabled) {
      return
    }

    const phases = this.projectFailed(rootWorkUnit, context)

    if (phases.length === 0) {
      return
    }

    instrumentation.onRequestTrace({ snapshot, trace: { outcome: 'error', phases } })
  }

  private project(rootUnit: WorkUnit): RequestTracePhase[] {
    return rootUnit.children.map(phaseUnit => {
      const phase = this.phaseName(phaseUnit.kind)
      const units: RequestTraceUnit[] = phaseUnit.children.map(child => this.serializer.serialize(child))

      if (phaseUnit.completed) {
        units.push(this.toContextSnapshotUnit(phase, phaseUnit.completeFields as ContextSnapshotData))
      }

      return { phase, units }
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

  private phaseName(kind: string): string {
    const prefix = 'request.'

    return kind.startsWith(prefix) ? kind.slice(prefix.length) : kind
  }
}
