import type { StepRequest } from '../../../framework/types/request.type'
import type { StepResponse } from '../../../framework/types/response.type'
import type { RuntimeEvaluationGlobalState } from '../../contracts/runtime/evaluationState.type'

export default class RuntimeEvaluationContext {
  constructor(
    readonly request: StepRequest,
    readonly response: StepResponse,
    readonly global: RuntimeEvaluationGlobalState = {
      data: {},
      answers: {},
    },
  ) {}
}
