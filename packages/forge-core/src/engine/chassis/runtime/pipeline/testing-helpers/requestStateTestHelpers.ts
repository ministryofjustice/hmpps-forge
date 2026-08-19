import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'
import type { ComponentRegistry } from '../../../../../framework/types/adapter.type'
import type { ResponseBindings } from '../../../../../framework/types/responseBindings.type'
import RequestState, { type RequestDependencies } from '../RequestState'

export function createTestRequestState(
  context: RuntimeContext,
  dependencyOverrides: Partial<RequestDependencies> = {},
): RequestState {
  return new RequestState(context, {
    responseBindings: {} as ResponseBindings,
    functionRegistry: {} as FunctionRegistry,
    componentRegistry: {} as ComponentRegistry,
    hasRenderer: false,
    traceEnabled: false,
    buildStepValidation: () => undefined,
    ...dependencyOverrides,
  })
}
