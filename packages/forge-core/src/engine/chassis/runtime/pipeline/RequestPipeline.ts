import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import type { ForgeError, ForgeOutcome } from '../../../../framework/types/outcome.type'
import type { MountedNode } from '../../registries/MountRegistry'
import type RequestState from './RequestState'
import type { RequestPipelineResult } from '../../contracts/runtime/requestPipelineOutput.type'
import RequestPipelineBootstrap from './RequestPipelineBootstrap'
import { resolveRedirectTarget } from '../../../concerns/route/runtime/redirectTarget'
import WorkContext from '../../work/WorkContext'
import WorkExecutor from '../../work/WorkExecutor'
import WorkExecutionError from '../../work/WorkExecutionError'
import type { WorkTask } from '../../contracts/work/work.type'
import type { ForgeInstrumentation } from '../../tracing/ForgeTraceSinkDispatcher'
import type { ForgeRenderer } from '../../../../framework/types/rendering.type'
import RequestPipelineTraceProjector from './RequestPipelineTraceProjector'
import { resolvePathParams } from '../../../../shared/routePath'
import { NO_OP_RESPONSE_BINDINGS, type ResponseBindings } from '../../../../framework/types/responseBindings.type'

export interface RequestPipelineOptions {
  readonly instrumentation: ForgeInstrumentation
  readonly maxIteratorIterations: number
}

export interface RequestEvaluationRequest {
  readonly node: MountedNode
  readonly snapshot: RequestSnapshot
  readonly responseBindings?: ResponseBindings
  readonly renderer?: ForgeRenderer<unknown>
  readonly adapterDependencies?: object
  readonly requestDependencies?: () => object | PromiseLike<object>
}

interface PreparedPipeline {
  readonly executionContext: RequestState
  readonly pipelineElement: WorkTask
}

export default class RequestPipeline {
  constructor(
    private readonly options: RequestPipelineOptions,
    private readonly traceProjector = new RequestPipelineTraceProjector(),
  ) {}

  async evaluate(requestInput: RequestEvaluationRequest): Promise<ForgeOutcome<unknown>> {
    const {
      node,
      snapshot,
      renderer,
      adapterDependencies,
      requestDependencies,
      responseBindings = NO_OP_RESPONSE_BINDINGS,
    } = requestInput

    const instrumentation = this.options.instrumentation.forRequest(snapshot)

    const { executionContext, pipelineElement } = this.preparePipeline(
      node,
      snapshot,
      responseBindings,
      instrumentation,
      renderer,
      adapterDependencies,
      requestDependencies,
    )

    const pipelineResult = await this.run(node, executionContext, pipelineElement, snapshot, instrumentation)

    return this.buildOutcome(pipelineResult, snapshot)
  }

  private preparePipeline(
    node: MountedNode,
    snapshot: RequestSnapshot,
    responseBindings: ResponseBindings,
    instrumentation: ForgeInstrumentation,
    renderer?: ForgeRenderer<unknown>,
    adapterDependencies?: object,
    requestDependencies?: () => object | PromiseLike<object>,
  ): PreparedPipeline {
    const bootstrap = new RequestPipelineBootstrap({
      method: snapshot.method,
      node,
      snapshot,
      renderer,
      traceEnabled: instrumentation.enabled,
      maxIteratorIterations: this.options.maxIteratorIterations,
      responseBindings,
      adapterDependencies,
      requestDependencies,
    })

    return {
      executionContext: bootstrap.buildExecutionContext(),
      pipelineElement: bootstrap.buildPipelineElement(),
    }
  }

  private async run(
    node: MountedNode,
    requestState: RequestState,
    pipelineElement: WorkTask,
    snapshot: RequestSnapshot,
    instrumentation: ForgeInstrumentation,
  ): Promise<RequestPipelineResult> {
    try {
      const workExecutor = new WorkExecutor(instrumentation.enabled)

      const completed = await workExecutor.executeWithUnit(pipelineElement, new WorkContext(requestState))

      const pipelineResult = requestState.pipelineResult

      this.traceProjector.emit({
        instrumentation,
        snapshot,
        root: completed.traceSpan,
        result: pipelineResult,
        redirectUrl:
          pipelineResult.kind === 'redirect' ? this.resolveRedirectUrl(pipelineResult.target, snapshot) : undefined,
        node,
        routeTree: requestState.routeTree,
        reachabilityEvaluation: requestState.reachabilityEvaluation,
      })

      return pipelineResult
    } catch (error) {
      if (error instanceof WorkExecutionError) {
        let unwrapped: unknown = error

        while (unwrapped instanceof WorkExecutionError) {
          unwrapped = unwrapped.original
        }

        this.traceProjector.emitFailed({
          instrumentation,
          snapshot,
          root: error.traceSpan,
          error: unwrapped,
          context: requestState.context,
          node,
          routeTree: requestState.routeTree,
          reachabilityEvaluation: requestState.reachabilityEvaluation,
        })

        throw unwrapped
      }

      throw error
    }
  }

  private buildOutcome(result: RequestPipelineResult, snapshot: RequestSnapshot): ForgeOutcome<unknown> {
    if (result.kind === 'redirect') {
      return {
        kind: 'navigate',
        url: this.resolveRedirectUrl(result.target, snapshot),
      }
    }

    if (result.kind === 'error') {
      const error: ForgeError = Object.assign(new Error(result.message), {
        status: result.status,
        statusCode: result.status,
      })

      return {
        kind: 'error',
        error,
      }
    }

    return {
      kind: 'render',
      context: result.context,
      output: result.output,
    }
  }

  private resolveRedirectUrl(target: string, snapshot: RequestSnapshot): string {
    const withParams = resolvePathParams(target, snapshot.params)

    return resolveRedirectTarget(withParams, snapshot.location).value
  }
}
