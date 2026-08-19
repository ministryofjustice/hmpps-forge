import type { NodeId } from '../ast/engine.type'
import type { AnswerHistory } from './answerHistory.type'
import type { JourneyReachabilityProjection } from '../../../concerns/reachability/contracts/journeyReachabilityProjection.type'
import type { RequestLocation } from '../../../../framework/types/request.type'
import type { ValidationResult } from '../../../concerns/validation/contracts/validationResult.type'
import type { StepValidityResult } from '../../../concerns/validation/contracts/stepValidityResult.type'

export interface StepValidationFailure extends ValidationResult {
  blockId: NodeId
}

export type DomainValidationFailure = ValidationResult

interface RequestContextState {
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

interface DomainContextState {
  data: Record<string, unknown>
  answers: Record<string, AnswerHistory>
}

interface EvaluationContextState {
  reachabilityValidities?: Map<NodeId, StepValidityResult>
  reachability?: JourneyReachabilityProjection
  fieldsToClear?: readonly string[]
}

export interface RuntimeContext {
  request: RequestContextState
  domain: DomainContextState
  evaluation: EvaluationContextState
}
