import type { RequestSnapshot } from '../../framework/types/snapshot.type'
import type { ForgeError, ForgeOutcome } from '../../framework/types/outcome.type'
import type { MountedNode } from '../registries/MountRegistry'
import type { PipelineState } from '../contracts/runtime/RequestExecution.type'
import type { RequestExecutionContext, RequestPipelineResult } from '../contracts/runtime/RequestExecutionContext.type'
import RequestPipelineBootstrap from './evaluation/request/RequestPipelineBootstrap'
import { resolveRedirectTarget } from './evaluation/phases/reachability/redirectTarget'
import type { RuntimeContext } from '../contracts/runtime/evaluationState.type'
import WorkContext from './evaluation/work/WorkContext'
import WorkExecutor from './evaluation/work/WorkExecutor'
import WorkExecutionError from './evaluation/work/WorkExecutionError'
import type { WorkTask } from '../contracts/runtime/work.type'
import type { ForgeInstrumentation } from '../diagnostics/ForgeTraceSinkDispatcher'
import type { ForgeRenderer } from '../../framework/rendering/types'
import RequestPipelineTraceProjector from './evaluation/request/RequestPipelineTraceProjector'
import { resolvePathParams } from '../../framework/path/routePath'
import { NO_OP_RESPONSE_BINDINGS, type ResponseBindings } from '../../framework/types/responseBindings.type'

export interface RequestEvaluatorOptions {
  readonly instrumentation: ForgeInstrumentation
}

export interface RequestEvaluationRequest {
  readonly node: MountedNode
  readonly snapshot: RequestSnapshot
  readonly responseBindings?: ResponseBindings
  readonly renderer?: ForgeRenderer<unknown>
}

interface PreparedPipeline {
  readonly executionContext: RequestExecutionContext
  readonly pipelineElement: WorkTask
}

export default class RequestEvaluator {
  constructor(
    private readonly options: RequestEvaluatorOptions,
    private readonly traceProjector = new RequestPipelineTraceProjector(),
  ) {}

  async evaluate(requestInput: RequestEvaluationRequest): Promise<ForgeOutcome<unknown>> {
    const { node, snapshot, renderer, responseBindings = NO_OP_RESPONSE_BINDINGS } = requestInput

    const instrumentation = this.options.instrumentation.forRequest(snapshot)

    const { executionContext, pipelineElement } = this.preparePipeline(
      node,
      snapshot,
      responseBindings,
      instrumentation,
      renderer,
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
  ): PreparedPipeline {
    const bootstrap = new RequestPipelineBootstrap({
      method: snapshot.method,
      node,
      snapshot,
      renderer,
      traceEnabled: instrumentation.enabled,
    })

    const context = {
      request: {},
      domain: {
        data: {},
        answers: {},
      },
      evaluation: {},
    } as RuntimeContext

    const state: PipelineState = { context, responseBindings }

    return {
      executionContext: bootstrap.buildExecutionContext(state),
      pipelineElement: bootstrap.buildPipelineElement(),
    }
  }

  private async run(
    node: MountedNode,
    requestExecutionContext: ReturnType<RequestPipelineBootstrap['buildExecutionContext']>,
    pipelineElement: WorkTask,
    snapshot: RequestSnapshot,
    instrumentation: ForgeInstrumentation,
  ): Promise<RequestPipelineResult> {
    try {
      const workExecutor = new WorkExecutor(instrumentation.enabled)

      const completed = await workExecutor.executeWithUnit(pipelineElement, new WorkContext(requestExecutionContext))

      const pipelineResult = requestExecutionContext.pipelineResult

      if (pipelineResult === undefined) {
        throw new Error('[Forge] Request pipeline completed without a result')
      }

      this.traceProjector.emitTrace(
        snapshot,
        instrumentation,
        pipelineResult,
        completed.traceSpan,
        node,
        requestExecutionContext.routeTree,
        requestExecutionContext.reachabilityEvaluation,
      )

      return pipelineResult
    } catch (error) {
      if (error instanceof WorkExecutionError) {
        let unwrapped: unknown = error

        while (unwrapped instanceof WorkExecutionError) {
          unwrapped = unwrapped.original
        }

        this.traceProjector.emitFailedTrace(
          snapshot,
          instrumentation,
          unwrapped,
          error.traceSpan,
          requestExecutionContext.context,
          node,
          requestExecutionContext.routeTree,
          requestExecutionContext.reachabilityEvaluation,
        )

        throw unwrapped
      }

      throw error
    }
  }

  private buildOutcome(result: RequestPipelineResult, snapshot: RequestSnapshot): ForgeOutcome<unknown> {
    if (result.kind === 'redirect') {
      const withParams = resolvePathParams(result.target, snapshot.params)
      const resolved = resolveRedirectTarget(withParams, snapshot.location)

      return {
        kind: 'navigate',
        url: resolved.value,
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
}
