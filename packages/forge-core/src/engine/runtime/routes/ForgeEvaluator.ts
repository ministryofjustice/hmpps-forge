import { PackageDependencies } from '../../contracts/ast/engine.type'
import { ForgeOptions } from '../../Forge'
import { normalizeBasePath } from '../../../framework/path/routePath'
import type PackageInstance from '../../PackageInstance'
import type { NodeId } from '../../contracts/ast/ast.type'
import {
  createRouteTreeIndex,
  JourneyRouteContext,
  JourneyRouteTemplateCatalog,
  RouteTreeIndex,
  StepRouteContext,
} from '../../contracts/routing/routeTree.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../../contracts/routing/routeDescriptors.type'
import RouteTreeBuilder from './RouteTreeBuilder'
import ContextPreparer from '../lifecycle/ContextPreparer'
import RequestOrchestrator from '../orchestrator/RequestOrchestrator'
import type { PipelineState } from '../orchestrator/types'
import { createAccessLifecyclePhase } from '../orchestrator/phases/accessLifecyclePhase'
import { createAnswerPreparationPhase } from '../orchestrator/phases/answerPreparationPhase'
import { createNavigationPhase } from '../orchestrator/phases/navigationPhase'
import { createEntryValidationPhase } from '../orchestrator/phases/entryValidationPhase'
import { createSubmitLifecyclePhase } from '../orchestrator/phases/submitLifecyclePhase'
import { createStepRenderTerminal } from '../orchestrator/terminals/stepRenderTerminal'
import { createJourneyRedirectTerminal } from '../orchestrator/terminals/journeyRedirectTerminal'
import SnapshotStepRequest from '../snapshot/SnapshotStepRequest'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import type { ComponentRegistry } from '../../../framework/types/adapter.type'
import type { RequestSnapshot } from '../../../framework/types/snapshot.type'
import type { ForgeErrorCode, ForgeOutcome } from '../../../framework/types/outcome.type'
import type { ForgeRoute, ForgeTopology } from '../../../framework/types/topology.type'

/**
 * One resolved node's runnable pipelines plus the immutable data needed to
 * evaluate and instrument it. `get` always exists for both steps and journey
 * roots; `post` is present only for steps (the submit pipeline).
 */
interface NodeExecutor {
  readonly staticData: Record<string, unknown>
  readonly componentRegistry: ComponentRegistry
  readonly get?: RequestOrchestrator
  readonly post?: RequestOrchestrator
}

/**
 * Builds the per-node evaluation pipelines from compiled journeys and exposes
 * them as a pure {@link evaluate} function plus a routes-as-data
 * {@link getTopology}. It owns no router and never touches a native request —
 * adapters consume the topology to register routes and call `evaluate`.
 */
export default class ForgeEvaluator {
  private readonly basePath: string

  private readonly routeTreeIndex: RouteTreeIndex = createRouteTreeIndex()

  private readonly contextPreparer = new ContextPreparer()

  private readonly executorsByRouteKey = new Map<string, NodeExecutor>()

  private readonly routes: ForgeRoute[] = []

  constructor(options: ForgeOptions) {
    this.basePath = normalizeBasePath(options.basePath)
  }

  /**
   * Registers every step and journey-root node of one compiled package as a
   * runnable {@link NodeExecutor} keyed by journey-scoped route key, and records
   * its {@link ForgeRoute} in the topology. Returns the number of executor
   * entries added (two per step for GET and POST, one per journey root).
   */
  mount(packageInstance: PackageInstance): number {
    const packageDependencies = packageInstance.getDependencies()
    const stepRouteIndex = packageInstance.getStepRouteIndex()
    const journeyRouteIndex = packageInstance.getJourneyRouteIndex()
    const routeTreeBuilder = new RouteTreeBuilder(this.routeTreeIndex)
    const { journeyContexts, stepContexts, catalogsByBasePath } = routeTreeBuilder.build({
      basePath: this.basePath,
      stepRouteIndex,
      journeyRouteIndex,
    })

    const stepCount = this.buildStepExecutors(stepContexts, stepRouteIndex, packageInstance, packageDependencies)
    const journeyCount = this.buildJourneyExecutors(
      journeyContexts,
      journeyRouteIndex,
      catalogsByBasePath,
      packageInstance,
      packageDependencies,
    )

    return stepCount + journeyCount
  }

  /** The routes-as-data view of every mounted node, for adapters to register. */
  getTopology(): ForgeTopology {
    return { routes: this.routes }
  }

  /**
   * Resolves the executor for `snapshot.nodeId`, picks the GET or POST
   * orchestrator by method, prepares a fresh per-request context, and runs the
   * pipeline. Returns a `navigate` outcome for a redirect result or a `render`
   * outcome (carrying the node's component registry) otherwise; yields an
   * `error` outcome when the node is unknown or the method is unsupported.
   */
  async evaluate(snapshot: RequestSnapshot, responseBindings: ResponseBindings): Promise<ForgeOutcome> {
    const executor = this.executorsByRouteKey.get(snapshot.nodeId)

    if (!executor) {
      return this.errorOutcome('node-not-found', `No route registered for node "${snapshot.nodeId}"`)
    }

    const orchestrator = snapshot.method === 'POST' ? executor.post : executor.get

    if (!orchestrator) {
      return this.errorOutcome('method-not-supported', `${snapshot.method} not allowed for node "${snapshot.nodeId}"`)
    }

    const request = new SnapshotStepRequest(snapshot)
    const context = this.contextPreparer.prepare({ staticData: executor.staticData }, request)
    const state: PipelineState = { context, request, responseBindings }

    const result = await orchestrator.execute(state)

    if (result.type === 'redirect') {
      return { kind: 'navigate', url: result.url }
    }

    return {
      kind: 'render',
      context: result.context,
      componentRegistry: executor.componentRegistry,
      output: undefined,
      renderedBlocks: [],
    }
  }

  /**
   * For each step context, assembles its GET orchestrator (access ->
   * answer-preparation -> navigation -> entry-validation, then the shared render
   * terminal) and POST orchestrator (access -> answer-preparation -> navigation
   * -> submit, same render terminal), registers both under one scoped route key,
   * and pushes a step {@link ForgeRoute}. Returns the executor count (two per
   * step).
   */
  private buildStepExecutors(
    stepContexts: StepRouteContext[],
    stepRouteIndex: StepRouteIndex,
    packageInstance: PackageInstance,
    packageDependencies: PackageDependencies,
  ): number {
    const { functionRegistry, componentRegistry } = packageDependencies
    const journeyCode = packageInstance.getJourneyCode()
    let count = 0

    stepContexts.forEach(ctx => {
      const compiledStep = packageInstance.getCompiledStep(ctx.stepNodeId)
      const runtimePlan = compiledStep.runtimePlan

      const accessPhase = createAccessLifecyclePhase(compiledStep.accessLifecyclePlan, functionRegistry)

      const answersPhase = createAnswerPreparationPhase(compiledStep.answerPreparationPlan, functionRegistry)

      const renderTerminal = createStepRenderTerminal(
        compiledStep.renderPlan,
        this.routeTreeIndex.roots,
        ctx.routeTemplatePath,
        functionRegistry,
      )

      const getOrchestrator = new RequestOrchestrator(
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
          createEntryValidationPhase(
            compiledStep.entryValidationPlan,
            compiledStep.validationPlan,
            runtimePlan.nodeId,
            functionRegistry,
          ),
        ],
        renderTerminal,
      )

      const postOrchestrator = new RequestOrchestrator(
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
          createSubmitLifecyclePhase(
            compiledStep.submitLifecyclePlan,
            compiledStep.validationPlan,
            runtimePlan.nodeId,
            functionRegistry,
          ),
        ],
        renderTerminal,
      )

      const routeKey = ForgeEvaluator.scopedRouteKey(journeyCode, ctx.stepNodeId)

      this.executorsByRouteKey.set(routeKey, {
        staticData: runtimePlan.staticData,
        componentRegistry,
        get: getOrchestrator,
        post: postOrchestrator,
      })

      this.routes.push({
        nodeId: routeKey,
        kind: 'step',
        templatePath: ctx.routeTemplatePath,
        basePath: ctx.journeyBasePath,
        methods: ['GET', 'POST'],
        title: stepRouteIndex.get(ctx.stepNodeId)?.title,
      })

      count += 2
    })

    return count
  }

  /**
   * For each journey root, assembles a GET-only orchestrator (access ->
   * answer-preparation, then a redirect terminal that sends the visitor to the
   * resolved entry step), registers it, and pushes a journey {@link ForgeRoute}.
   * Skips any journey whose compiled artefact or template catalog is missing.
   * Returns the executor count (one per journey root).
   */
  private buildJourneyExecutors(
    journeyContexts: JourneyRouteContext[],
    journeyRouteIndex: JourneyRouteIndex,
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
    packageInstance: PackageInstance,
    packageDependencies: PackageDependencies,
  ): number {
    const { functionRegistry, componentRegistry } = packageDependencies
    const journeyCode = packageInstance.getJourneyCode()
    let count = 0

    journeyContexts.forEach(({ journeyNodeId, templatePath }) => {
      const compiledJourney = packageInstance.getCompiledJourney(journeyNodeId)
      const routeTemplateCatalog = catalogsByBasePath.get(templatePath)

      if (!compiledJourney || !routeTemplateCatalog) {
        return
      }

      const runtimePlan = compiledJourney.runtimePlan

      const orchestrator = new RequestOrchestrator(
        [
          createAccessLifecyclePhase(compiledJourney.accessLifecyclePlan, functionRegistry),
          createAnswerPreparationPhase(compiledJourney.answerPreparationPlan, functionRegistry),
        ],
        createJourneyRedirectTerminal<undefined>(
          compiledJourney.navigationPlan,
          routeTemplateCatalog,
          functionRegistry,
        ),
      )

      const routeKey = ForgeEvaluator.scopedRouteKey(journeyCode, journeyNodeId)

      this.executorsByRouteKey.set(routeKey, {
        staticData: runtimePlan.staticData,
        componentRegistry,
        get: orchestrator,
      })

      this.routes.push({
        nodeId: routeKey,
        kind: 'journey',
        templatePath,
        basePath: templatePath,
        methods: ['GET'],
        title: journeyRouteIndex.get(journeyNodeId)?.title,
      })

      count += 1
    })

    return count
  }

  /** Namespaces a node id under its journey so route keys stay unique across journeys. */
  private static scopedRouteKey(journeyCode: string, nodeId: NodeId): string {
    return `${journeyCode}::${nodeId}`
  }

  /** Wraps a code/message pair as an `error` {@link ForgeOutcome}. */
  private errorOutcome(code: ForgeErrorCode, message: string): ForgeOutcome {
    return { kind: 'error', error: { code, message } }
  }
}
