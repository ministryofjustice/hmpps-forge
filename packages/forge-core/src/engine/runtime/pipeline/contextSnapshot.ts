import type {
  JourneyReachabilityProjection,
  StepReachabilityProjection,
} from '../../concerns/reachability/contracts/journeyReachabilityProjection.type'
import type { AnswerHistory, AnswerMutation } from '../../contracts/runtime/answerHistory.type'
import type {
  DomainValidationFailure,
  StepValidationFailure,
  RuntimeContext,
} from '../../contracts/runtime/evaluationState.type'
import type { NodeId } from '../../contracts/ast/ast.type'
import type { StepValidityResult } from '../../concerns/validation/contracts/stepValidityResult.type'
import type { WorkContextContract, WorkInstrumentation } from '../../contracts/work/work.type'
import type { PhaseWorkOutput } from '../../contracts/runtime/requestPipelineOutput.type'
import type RequestState from './RequestState'

/**
 * A deep-cloned, point-in-time copy of the request's runtime evaluation state.
 * Captured by each phase's `resolveTraceMetadataAtFinish` instrumentation when its work unit completes, so
 * the value is frozen at that phase and unaffected by later mutations. The trace
 * projection wraps it into a `context-snapshot` `RequestTraceUnit`.
 */
export type ContextSnapshotData = {
  readonly answers: Record<string, AnswerHistory>
  readonly data: Record<string, unknown>
  readonly reachabilityValidities?: Record<NodeId, StepValidityResult>
  readonly reachability?: JourneyReachabilityProjection
}

export function captureContextSnapshot(context: RuntimeContext): ContextSnapshotData {
  return {
    answers: cloneAnswers(context.domain.answers),
    data: cloneRecord(context.domain.data),
    reachabilityValidities: cloneReachabilityValidities(context.evaluation.reachabilityValidities),
    reachability: cloneReachability(context.evaluation.reachability),
  }
}

/**
 * The shared after-phase instrumentation: every request phase snapshots the
 * request context on completion. A generic function rather than a const because
 * `WorkInstrumentation` ties the ctx to the phase's props.
 */
export function phaseInstrumentation<TProps>(): WorkInstrumentation<TProps, PhaseWorkOutput> {
  return {
    resolveTraceMetadataAtStart() {
      return undefined
    },

    resolveTraceMetadataAtFinish(ctx: WorkContextContract<RequestState, TProps>) {
      return captureContextSnapshot(ctx.state.context)
    },
  }
}

function cloneAnswers(answers: Record<string, AnswerHistory>): Record<string, AnswerHistory> {
  return Object.entries(answers).reduce<Record<string, AnswerHistory>>((clonedAnswers, [key, history]) => {
    clonedAnswers[key] = {
      current: cloneValue(history.current),
      parsed: history.parsed === undefined ? undefined : cloneValue(history.parsed),
      mutations: history.mutations.map(mutation => cloneAnswerMutation(mutation)),
    }

    return clonedAnswers
  }, {})
}

function cloneAnswerMutation(mutation: AnswerMutation): AnswerMutation {
  return {
    value: cloneValue(mutation.value),
    source: mutation.source,
  }
}

function cloneRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(record).reduce<Record<string, unknown>>((clonedRecord, [key, value]) => {
    clonedRecord[key] = cloneValue(value)

    return clonedRecord
  }, {})
}

function cloneReachabilityValidities(
  reachabilityValidities: ReadonlyMap<NodeId, StepValidityResult> | undefined,
): Record<NodeId, StepValidityResult> | undefined {
  if (reachabilityValidities === undefined) {
    return undefined
  }

  const cloned: Record<NodeId, StepValidityResult> = {}

  reachabilityValidities.forEach((validity, stepId) => {
    cloned[stepId] = {
      fieldFailures: validity.fieldFailures.map(failure => cloneStepValidationFailure(failure)),
      domainFailures: validity.domainFailures.map(failure => cloneDomainValidationFailure(failure)),
    }
  })

  return cloned
}

function cloneStepValidationFailure(failure: StepValidationFailure): StepValidationFailure {
  return {
    ...cloneDomainValidationFailure(failure),
    blockId: failure.blockId,
  }
}

function cloneDomainValidationFailure(failure: DomainValidationFailure): DomainValidationFailure {
  return {
    passed: failure.passed,
    message: failure.message,
    submissionOnly: failure.submissionOnly,
    groups: [...failure.groups],
    details: failure.details === undefined ? undefined : cloneRecord(failure.details),
    blockCode: failure.blockCode,
  }
}

function cloneReachability(
  reachability: JourneyReachabilityProjection | undefined,
): JourneyReachabilityProjection | undefined {
  if (reachability === undefined) {
    return undefined
  }

  return {
    reachableSteps: reachability.reachableSteps.map(step => cloneStepReachabilityProjection(step)),
    unreachableSteps: reachability.unreachableSteps.map(step => cloneStepReachabilityProjection(step)),
  }
}

function cloneStepReachabilityProjection(step: StepReachabilityProjection): StepReachabilityProjection {
  return {
    path: step.path,
    code: step.code,
    fieldCodes: step.fieldCodes === undefined ? undefined : [...step.fieldCodes],
    cleardownFieldCodes: step.cleardownFieldCodes === undefined ? undefined : [...step.cleardownFieldCodes],
    backPath: step.backPath,
  }
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item))
  }

  if (isRecord(value)) {
    return cloneRecord(value)
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}
