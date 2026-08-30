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
  const dependencies = resolveDependencies(
    ctx.state.dependencies.packageDependencies,
    ctx.state.dependencies.adapterDependencies,
    requestDependencies,
  )

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

interface DependencySource {
  readonly name: 'packageDependencies' | 'adapterDependencies' | 'requestDependencies'
  readonly dependencies: unknown
}

function resolveDependencies(
  packageDependencies: unknown,
  adapterDependencies: object | undefined,
  requestDependencies: unknown,
): unknown {
  const sources: DependencySource[] = [{ name: 'packageDependencies', dependencies: packageDependencies ?? {} }]

  if (adapterDependencies !== undefined) {
    sources.push({ name: 'adapterDependencies', dependencies: adapterDependencies })
  }

  if (requestDependencies !== NO_REQUEST_DEPENDENCIES) {
    sources.push({ name: 'requestDependencies', dependencies: requestDependencies })
  }

  if (sources.length === 1) {
    return packageDependencies
  }

  const mergedDependencies: Record<string, unknown> = {}
  const sourceByKey = new Map<string, DependencySource['name']>()

  sources.forEach(source => {
    assertDependencyObject(source)
    const keys = Object.keys(source.dependencies)
    const collisions = keys.filter(key => sourceByKey.has(key))

    if (collisions.length > 0) {
      const existingSources = [...new Set(collisions.map(key => sourceByKey.get(key)))].join(' and ')

      throw new TypeError(
        `${source.name} contains keys already provided by ${existingSources}: ${collisions.join(', ')}`,
      )
    }

    Object.assign(mergedDependencies, source.dependencies)
    keys.forEach(key => sourceByKey.set(key, source.name))
  })

  return mergedDependencies
}

function assertDependencyObject(
  source: DependencySource,
): asserts source is DependencySource & { readonly dependencies: object } {
  if (source.dependencies === null || typeof source.dependencies !== 'object') {
    const verb = source.name === 'requestDependencies' ? 'resolve to' : 'be'

    throw new TypeError(`${source.name} must ${verb} an object`)
  }
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
