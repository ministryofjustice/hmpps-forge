import type Forge from './Forge'
import type { MountedPackage } from './runtime/routes/MountRegistry'
import type { StoredRouteTree } from './contracts/routing/routeTree.type'
import ContextPreparer from './runtime/lifecycle/ContextPreparer'
import RequestPipeline from './runtime/pipeline/RequestPipeline'
import type { PipelineState } from './runtime/pipeline/types'
import { createAccessLifecyclePhase } from './runtime/pipeline/phases/accessLifecyclePhase'
import { createAnswerPreparationPhase } from './runtime/pipeline/phases/answerPreparationPhase'
import { createNavigationPhase } from './runtime/pipeline/phases/navigationPhase'
import { createCleardownPhase } from './runtime/pipeline/phases/cleardownPhase'
import { createEntryValidationPhase } from './runtime/pipeline/phases/entryValidationPhase'
import { createSubmitLifecyclePhase } from './runtime/pipeline/phases/submitLifecyclePhase'
import { createRenderEvaluationPhase } from './runtime/pipeline/phases/renderEvaluationPhase'
import { createRenderOutputTerminal } from './runtime/pipeline/terminals/renderOutputTerminal'
import { createJourneyRedirectTerminal } from './runtime/pipeline/terminals/journeyRedirectTerminal'
import SnapshotStepRequest from './runtime/snapshot/SnapshotStepRequest'
import TraceRecorder from './runtime/pipeline/trace/TraceRecorder'
import { createChannelTraceObserver } from './runtime/pipeline/trace/channelTraceObserver'
import type { NodeId } from './contracts/ast/ast.type'
import type { ResponseBindings } from '../framework/types/responseBindings.type'
import { NO_OP_RESPONSE_BINDINGS } from '../framework/types/responseBindings.type'
import type { ForgeRenderer } from '../framework/rendering/types'
import type { ComponentRegistry } from '../framework/types/adapter.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { ForgeErrorCode, ForgeOutcome } from '../framework/types/outcome.type'
import type { ForgeTopology } from '../framework/types/topology.type'
import type { TraceObserver } from '../framework/types/traceObserver.type'

export interface EvaluateOptions {
  response?: ResponseBindings
}

export interface ForgeOrchestratorOptions<TOut = undefined> {
  /** The configured engine to serve; register all packages before constructing. */
  readonly core: Forge
  /** Renderer bound for the orchestrator's lifetime; absent means context-only render outcomes. */
  readonly renderer?: ForgeRenderer<TOut>
  /**
   * Receives each traced request's decision log. Omitted defaults to the
   * `forge:request:complete` diagnostics-channel publisher, which is inert
   * until something subscribes; `'off'` or `false` disables tracing entirely.
   */
  readonly traceObserver?: TraceObserver | 'off' | false
}

/**
 * One resolved node's runnable pipelines plus the immutable data needed to
 * evaluate and instrument it. `get` always exists for both steps and journey
 * roots; `post` is present only for steps (the submit pipeline).
 */
interface NodeExecutor<TOut> {
  readonly staticData: Record<string, unknown>
  readonly componentRegistry: ComponentRegistry
  readonly get?: RequestPipeline<TOut>
  readonly post?: RequestPipeline<TOut>
}

/**
 * Drives the full request lifecycle for a configured {@link Forge} engine,
 * binding an optional {@link ForgeRenderer} for the lifetime of the instance.
 * At construction it assembles the per-node evaluation pipelines from the
 * engine's mounted artefacts, so packages registered after construction are
 * not served — construct it once registration is complete (the express
 * adapter and test harness both do). Multiple orchestrators over one engine
 * are safe: executors close over immutable compiled plans.
 *
 * Traced requests are reported through the configured {@link TraceObserver};
 * by default traces publish on the `forge:request:complete` diagnostics
 * channel, which costs nothing until something subscribes.
 *
 * @example
 * ```typescript
 * const core = new Forge({ logger }).registerPackage(myPackage)
 *
 * // Server: bind a renderer; render outcomes carry assembled output.
 * const orchestrator = new ForgeOrchestrator({ core, renderer: new NunjucksRenderer({ nunjucksEnv }) })
 *
 * // Tests: no renderer; render outcomes are context-only. Tracing off.
 * const bare = new ForgeOrchestrator({ core, traceObserver: 'off' })
 * ```
 */
export default class ForgeOrchestrator<TOut = undefined> {
  private readonly core: Forge

  private readonly renderer?: ForgeRenderer<TOut>

  private readonly traceObserver?: TraceObserver

  private readonly routeTreeRoots: StoredRouteTree

  private readonly contextPreparer = new ContextPreparer()

  private readonly executorsByRouteKey = new Map<string, NodeExecutor<TOut>>()

  constructor(options: ForgeOrchestratorOptions<TOut>) {
    const { core, renderer, traceObserver } = options
    const tracingDisabled = traceObserver === 'off' || traceObserver === false

    this.core = core
    this.renderer = renderer
    this.traceObserver = tracingDisabled ? undefined : (traceObserver ?? createChannelTraceObserver())

    const runtime = core.getRuntime()
    this.routeTreeRoots = runtime.routeTreeRoots
    runtime.mounts.forEach(mount => {
      this.buildStepExecutors(mount)
      this.buildJourneyExecutors(mount)
    })
  }

  /** The engine's topology, delegated so adapters and test clients need only one object. */
  getTopology(): ForgeTopology {
    return this.core.getTopology()
  }

  /**
   * Evaluate a single request against the registered journeys.
   *
   * Resolves the executor for `snapshot.nodeId`, picks the GET or POST
   * pipeline by method, prepares a fresh per-request context, and runs the
   * pipeline. Returns a `navigate` outcome for a redirect result or a `render`
   * outcome (carrying the node's component registry) otherwise; yields an
   * `error` outcome when the node is unknown, the method is unsupported, or a
   * lifecycle hook halted the request with an error.
   *
   * When the trace observer accepts the request, the pipeline records into a
   * fresh {@link TraceRecorder} and the sealed trace is handed to the observer
   * exactly once — on render, redirect, and error completions alike.
   */
  async evaluate(snapshot: RequestSnapshot, options?: EvaluateOptions): Promise<ForgeOutcome<TOut>> {
    const executor = this.executorsByRouteKey.get(snapshot.nodeId)

    if (!executor) {
      return this.errorOutcome('node-not-found', `No route registered for node "${snapshot.nodeId}"`)
    }

    const pipeline = snapshot.method === 'POST' ? executor.post : executor.get

    if (!pipeline) {
      return this.errorOutcome('method-not-supported', `${snapshot.method} not allowed for node "${snapshot.nodeId}"`)
    }

    const request = new SnapshotStepRequest(snapshot)
    const context = this.contextPreparer.prepare({ staticData: executor.staticData }, request)
    const observer = this.traceObserver
    const trace = observer && observer.shouldTrace(snapshot) ? new TraceRecorder() : undefined
    const state: PipelineState = {
      context,
      request,
      responseBindings: options?.response ?? NO_OP_RESPONSE_BINDINGS,
      trace,
    }

    try {
      const result = await pipeline.execute(state)

      if (observer && trace) {
        observer.onTrace({ snapshot, trace: trace.finish(result.type) })
      }

      if (result.type === 'redirect') {
        return { kind: 'navigate', url: result.url }
      }

      if (result.type === 'error') {
        return { kind: 'error', error: { status: result.status, message: result.message } }
      }

      return {
        kind: 'render',
        context: result.context,
        componentRegistry: executor.componentRegistry,
        output: result.output,
        renderedBlocks: result.renderedBlocks,
      }
    } catch (error) {
      if (observer && trace) {
        observer.onTrace({ snapshot, trace: trace.finish('error') })
      }

      throw error
    }
  }

  /**
   * For each step context, assembles its GET pipeline (access ->
   * answer-preparation -> navigation -> cleardown -> entry-validation ->
   * render-evaluation, then the shared render-output terminal) and POST
   * pipeline (access -> answer-preparation -> navigation -> cleardown ->
   * submit -> render-evaluation, same
   * terminal), and registers both under one scoped route key.
   */
  private buildStepExecutors(mount: MountedPackage): void {
    const { functionRegistry, componentRegistry } = mount.dependencies
    const { journeyCode, packageInstance } = mount

    mount.stepContexts.forEach(ctx => {
      const compiledStep = packageInstance.getCompiledStep(ctx.stepNodeId)
      const runtimePlan = compiledStep.runtimePlan

      const accessPhase = createAccessLifecyclePhase(compiledStep.accessLifecyclePlan, functionRegistry)

      const answersPhase = createAnswerPreparationPhase(compiledStep.answerPreparationPlan, functionRegistry)

      const renderEvaluationPhase = createRenderEvaluationPhase(
        compiledStep.renderPlan,
        this.routeTreeRoots,
        ctx.routeTemplatePath,
        functionRegistry,
      )

      const renderOutputTerminal = createRenderOutputTerminal<TOut>(componentRegistry, this.renderer)

      const getPipeline = new RequestPipeline(
        [
          accessPhase,
          answersPhase,
          createNavigationPhase(
            compiledStep.navigationPlan,
            runtimePlan.nodeId,
            ctx.routeTemplateCatalog,
            'step-get',
            functionRegistry,
          ),
          createCleardownPhase(),
          createEntryValidationPhase(
            compiledStep.entryValidationPlan,
            compiledStep.validationPlan,
            runtimePlan.nodeId,
            functionRegistry,
          ),
          renderEvaluationPhase,
        ],
        renderOutputTerminal,
      )

      const postPipeline = new RequestPipeline(
        [
          accessPhase,
          answersPhase,
          createNavigationPhase(
            compiledStep.navigationPlan,
            runtimePlan.nodeId,
            ctx.routeTemplateCatalog,
            'step-post',
            functionRegistry,
          ),
          createCleardownPhase(),
          createSubmitLifecyclePhase(
            compiledStep.submitLifecyclePlan,
            compiledStep.validationPlan,
            runtimePlan.nodeId,
            functionRegistry,
          ),
          renderEvaluationPhase,
        ],
        renderOutputTerminal,
      )

      this.executorsByRouteKey.set(this.scopedRouteKey(journeyCode, ctx.stepNodeId), {
        staticData: runtimePlan.staticData,
        componentRegistry,
        get: getPipeline,
        post: postPipeline,
      })
    })
  }

  /**
   * For each journey root, assembles a GET-only pipeline (access ->
   * answer-preparation, then a redirect terminal that sends the visitor to the
   * resolved entry step) and registers it. Skips any journey whose compiled
   * artefact or template catalog is missing — mirroring the topology skip in
   * `MountRegistry`.
   */
  private buildJourneyExecutors(mount: MountedPackage): void {
    const { functionRegistry, componentRegistry } = mount.dependencies
    const { journeyCode, packageInstance } = mount

    mount.journeyContexts.forEach(({ journeyNodeId, templatePath }) => {
      const compiledJourney = packageInstance.getCompiledJourney(journeyNodeId)
      const routeTemplateCatalog = mount.catalogsByBasePath.get(templatePath)

      if (!compiledJourney || !routeTemplateCatalog) {
        return
      }

      const runtimePlan = compiledJourney.runtimePlan

      const pipeline = new RequestPipeline(
        [
          createAccessLifecyclePhase(compiledJourney.accessLifecyclePlan, functionRegistry),
          createAnswerPreparationPhase(compiledJourney.answerPreparationPlan, functionRegistry),
        ],
        createJourneyRedirectTerminal<TOut>(compiledJourney.navigationPlan, routeTemplateCatalog, functionRegistry),
      )

      this.executorsByRouteKey.set(this.scopedRouteKey(journeyCode, journeyNodeId), {
        staticData: runtimePlan.staticData,
        componentRegistry,
        get: pipeline,
      })
    })
  }

  /** Namespaces a node id under its journey so route keys stay unique across journeys. */
  private scopedRouteKey(journeyCode: string, nodeId: NodeId): string {
    return `${journeyCode}::${nodeId}`
  }

  /** Wraps a code/message pair as an `error` {@link ForgeOutcome}. */
  private errorOutcome(code: ForgeErrorCode, message: string): ForgeOutcome<TOut> {
    return { kind: 'error', error: { code, message } }
  }
}
