import type { AnswerHistory } from './answerHistory.type'
import type { JourneyReachabilityState } from '../navigation/journeyReachabilityState.type'
import type { StepRequest } from '../../../framework/types/request.type'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'

export interface EffectEvaluationContext {
  global: {
    data: Record<string, unknown>
    answers: Record<string, AnswerHistory>
    reachability?: JourneyReachabilityState
  }
  request: StepRequest
  response: ResponseBindings
}
