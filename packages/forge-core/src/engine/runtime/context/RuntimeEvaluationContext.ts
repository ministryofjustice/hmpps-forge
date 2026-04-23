import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { CompilationDependencies } from '../../compilation/CompilationDependencies'
import { AnswerHistory } from '../types/AnswerHistory.type'
import type { StepRequest } from '../../../framework/types/request.type'
import type { StepResponse } from '../../../framework/types/response.type'
import { ValidationResult } from '../types/ValidationResult.type'

export interface StepValidationFailure extends ValidationResult {
  blockId: NodeId
}

export type DomainValidationFailure = ValidationResult

export interface StepValidationState {
  stepId: NodeId
  validated: boolean
  isValid: boolean
  fieldFailures: StepValidationFailure[]
  domainFailures: DomainValidationFailure[]
}

export interface ReachabilityStep {
  path: string
  code?: string
  fieldCodes?: string[]
  cleardownFieldCodes?: string[]
  backPath?: string
}

export interface JourneyReachabilityState {
  reachableSteps: ReachabilityStep[]
  unreachableSteps: ReachabilityStep[]
}

/**
 * Global mutable state shared by the compiled functions for one request.
 */
export interface RuntimeEvaluationGlobalState {
  data: Record<string, unknown>
  answers: Record<string, AnswerHistory>
  validation?: StepValidationState
  reachability?: JourneyReachabilityState
}

export default class RuntimeEvaluationContext {
  constructor(
    private readonly compilationDependencies: CompilationDependencies,
    private readonly journeyInstanceDependencies: JourneyInstanceDependencies,
    readonly request: StepRequest,
    readonly response: StepResponse,
    readonly global: RuntimeEvaluationGlobalState = {
      data: {},
      answers: {},
    },
  ) {}

  get nodeRegistry() {
    return this.compilationDependencies.nodeRegistry
  }

  get logger() {
    return this.journeyInstanceDependencies.logger
  }

  get functionRegistry() {
    return this.journeyInstanceDependencies.functionRegistry
  }

  get astNodeTree() {
    return this.compilationDependencies.astNodeTree
  }
}
