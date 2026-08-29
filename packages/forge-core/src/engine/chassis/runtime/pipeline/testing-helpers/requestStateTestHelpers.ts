import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'
import type { ComponentRegistry } from '../../../../../framework/types/adapter.type'
import type { ResponseBindings } from '../../../../../framework/types/responseBindings.type'
import RequestState, { type RequestStateDependencies } from '../RequestState'

type TestRequestDependencies = Partial<RequestStateDependencies> & {
  readonly functionRegistry?: FunctionRegistry
}

export function createTestRequestState(
  context: RuntimeContext,
  dependencyOverrides: TestRequestDependencies = {},
): RequestState {
  const { functionRegistry = {} as FunctionRegistry, ...requestDependencyOverrides } = dependencyOverrides
  const requestState = new RequestState(context, {
    responseBindings: {} as ResponseBindings,
    functionBuilders: [],
    packageDependencies: {},
    componentRegistry: {} as ComponentRegistry,
    hasRenderer: false,
    traceEnabled: false,
    ...requestDependencyOverrides,
  })

  requestState.recordFunctionRegistry(functionRegistry)

  return requestState
}
