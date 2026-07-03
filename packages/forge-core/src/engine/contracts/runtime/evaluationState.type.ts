import type { NodeId } from '../ast/engine.type'
import type { AnswerHistory } from './answerHistory.type'
import type { JourneyReachabilityProjection } from '../reachability/journeyReachabilityProjection.type'
import type { RequestLocation } from '../../../framework/types/request.type'
import type { ValidationResult } from './validationResult.type'
import type { StepValidityResult } from './stepValidityResult.type'

export interface StepValidationFailure extends ValidationResult {
  blockId: NodeId
}

export type DomainValidationFailure = ValidationResult

export interface RequestContextState {
  url: string
  path: string
  method: string
  location: RequestLocation
  headers: Record<string, string | string[] | undefined>
  cookies: Record<string, string | undefined>
  state: Record<string, unknown>
  params: Record<string, string>
  query: Record<string, string | string[]>
  post: Record<string, unknown>
  session: Record<string, unknown>
}

export interface DomainContextState {
  data: Record<string, unknown>
  answers: Record<string, AnswerHistory>
}

export interface EvaluationContextState {
  stepValidities?: Map<NodeId, StepValidityResult>
  reachability?: JourneyReachabilityProjection
  fieldsToClear?: readonly string[]
}

export interface RuntimeContext {
  request: RequestContextState
  domain: DomainContextState
  evaluation: EvaluationContextState
}
