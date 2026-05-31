import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import { StepRequest } from '../../../framework/types/request.type'

interface StaticDataRuntimeInputs {
  staticData: Record<string, unknown>
}

export default class ContextPreparer {

  prepare(
    runtimePlan: StaticDataRuntimeInputs,
    request: StepRequest,
  ): RuntimeEvaluationContext {
    const context = new RuntimeEvaluationContext(request)

    Object.assign(context.global.data, runtimePlan.staticData)

    return context
  }
}
