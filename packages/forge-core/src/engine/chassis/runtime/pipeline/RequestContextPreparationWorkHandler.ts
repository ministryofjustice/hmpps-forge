import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../contracts/work/work.type'
import { phaseInstrumentation } from './contextSnapshot'
import { createWorkTask } from '../../work/workTask'
import type { RequestContextPreparationWorkProps } from '../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from './RequestState'
import type { PhaseWorkOutput } from '../../contracts/runtime/requestPipelineOutput.type'
import FunctionRegistry from '../../registries/FunctionRegistry'

const REQUEST_CONTEXT_PREPARATION_KIND = 'request.context-preparation'
const NO_REQUEST_DEPENDENCIES = Symbol('forge.no-request-dependencies')

export const REQUEST_CONTEXT_PREPARATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestContextPreparationWorkProps,
  PhaseWorkOutput
> = phaseInstrumentation()

export const REQUEST_CONTEXT_PREPARATION_WORK_HANDLER: WorkHandler<
  'request.context-preparation',
  RequestContextPreparationWorkProps
> = {
  kind: REQUEST_CONTEXT_PREPARATION_KIND,

  begin(ctx: WorkContextContract<RequestState, RequestContextPreparationWorkProps>) {
    const { requestDependencies } = ctx.state.dependencies

    if (requestDependencies === undefined) {
      return prepareRequestContext(ctx, NO_REQUEST_DEPENDENCIES)
    }

    const resolvedRequestDependencies = requestDependencies()

    if (isThenable(resolvedRequestDependencies)) {
      return Promise.resolve(resolvedRequestDependencies).then(dependencies => prepareRequestContext(ctx, dependencies))
    }

    return prepareRequestContext(ctx, resolvedRequestDependencies)
  },
}

function prepareRequestContext(
  ctx: WorkContextContract<RequestState, RequestContextPreparationWorkProps>,
  requestDependencies: unknown,
) {
  const functionRegistry = new FunctionRegistry()
  const dependencies = resolveDependencies(ctx.state.dependencies.packageDependencies, requestDependencies)

  ctx.state.dependencies.functionBuilders.forEach(functionBuilder => {
    functionRegistry.register(functionBuilder.build(dependencies))
  })

  ctx.state.recordFunctionRegistry(functionRegistry)

  const context = ctx.state.context
  const snapshot = ctx.props.snapshot
  const staticData = ctx.props.compiledStaticData()

  Object.assign(context.domain.data, staticData)

  context.request = {
    url: snapshot.location.href,
    path: snapshot.location.pathname,
    method: snapshot.method,
    location: snapshot.location,
    headers: snapshot.headers,
    cookies: snapshot.cookies,
    state: snapshot.state,
    params: snapshot.params,
    query: snapshot.query,
    post: snapshot.post,
    session: (snapshot.session ?? {}) as Record<string, unknown>,
  }

  return { output: { action: 'continue' as const } }
}

function resolveDependencies(packageDependencies: unknown, requestDependencies: unknown): unknown {
  if (requestDependencies === NO_REQUEST_DEPENDENCIES) {
    return packageDependencies
  }

  if (requestDependencies === null || typeof requestDependencies !== 'object') {
    throw new TypeError('requestDependencies must resolve to an object')
  }

  const packageDependencyKeys = new Set(Object.keys(packageDependencies ?? {}))
  const collisions = Object.keys(requestDependencies).filter(key => packageDependencyKeys.has(key))

  if (collisions.length > 0) {
    throw new TypeError(
      `requestDependencies contains keys already provided by packageDependencies: ${collisions.join(', ')}`,
    )
  }

  return { ...(packageDependencies as object), ...requestDependencies }
}

function isThenable(value: unknown): value is PromiseLike<object> {
  return value !== null &&
    value !== undefined &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
}

export function createRequestContextPreparationTask(props: RequestContextPreparationWorkProps) {
  return createWorkTask(
    'context-preparation',
    REQUEST_CONTEXT_PREPARATION_WORK_HANDLER,
    props,
    REQUEST_CONTEXT_PREPARATION_WORK_INSTRUMENTATION,
  )
}
