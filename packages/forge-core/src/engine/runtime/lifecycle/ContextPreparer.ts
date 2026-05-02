import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import { StepRequest } from '../../../framework/types/request.type'
import { StepResponse } from '../../../framework/types/response.type'

interface StaticDataRuntimeInputs {
  staticData: Record<string, unknown>
}

/**
 * Creates and prepares the evaluation context before hooks run.
 *
 * Access hooks can read the prepared static data via context.getData().
 */
export default class ContextPreparer {

  /**
   * Create an evaluation context with merged static data.
   *
   * @returns A context ready for hook execution and evaluation
   */
  prepare(
    runtimePlan: StaticDataRuntimeInputs,
    request: StepRequest,
    response: StepResponse,
  ): RuntimeEvaluationContext {
    const context = new RuntimeEvaluationContext(request, response)

    Object.assign(context.global.data, runtimePlan.staticData)

    return context
  }
}
