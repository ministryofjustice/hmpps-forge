import { ForgeDependencies, PackageDependencies } from '../../contracts/ast/engine.type'
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
import { createAnswerPreparationPlanPhase } from '../orchestrator/phases/answerPreparationPhase'
import { createNavigationPhase } from '../orchestrator/phases/navigationPhase'
import { createEntryValidationPhase } from '../orchestrator/phases/entryValidationPhase'
import { createSubmitPhase } from '../orchestrator/phases/submitPhase'
import { createStepRenderTerminal } from '../orchestrator/terminals/stepRenderTerminal'
import { createJourneyRedirectTerminal } from '../orchestrator/terminals/journeyRedirectTerminal'
import { resolveStepRequestRedirect, resolvePostRequestRedirect } from '../navigation/navigationRedirects'
import SnapshotStepRequest from '../snapshot/SnapshotStepRequest'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import type { ComponentRegistry } from '../../../framework/types/adapter.type'
import type { RequestSnapshot } from '../../../framework/types/snapshot.type'
import type { ForgeErrorCode, ForgeOutcome } from '../../../framework/types/outcome.type'
import type { ForgeRoute, ForgeTopology } from '../../../framework/types/topology.type'

interface NodeExecutor {
  readonly route: string
  readonly journeyCode: string
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

  constructor(
    private readonly forgeDependencies: ForgeDependencies,
    options: ForgeOptions,
  ) {
    this.basePath = normalizeBasePath(options.basePath)
  }

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

  getTopology(): ForgeTopology {
    return { routes: this.routes }
  }

  async evaluate(snapshot: RequestSnapshot, responseBindings: ResponseBindings): Promise<ForgeOutcome> {
    const executor = this.executorsByRouteKey.get(snapshot.nodeId)

    if (!executor) {
      return this.errorOutcome('node-not-found', `No route registered for node "${snapshot.nodeId}"`)
    }

    const orchestrator = snapshot.method === 'POST' ? executor.post : executor.get

    if (!orchestrator) {
      return this.errorOutcome('method-not-supported', `${snapshot.method} not allowed for node "${snapshot.nodeId}"`)
    }

    this.forgeDependencies.instrumentation.getCurrentSpan()?.setAttributes({
      'http.route': executor.route,
      'forge.journey.code': executor.journeyCode,
    })

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
    }
  }

  private buildStepExecutors(
    stepContexts: StepRouteContext[],
    stepRouteIndex: StepRouteIndex,
    packageInstance: PackageInstance,
    packageDependencies: PackageDependencies,
  ): number {
    const { instrumentation } = this.forgeDependencies
    const { functionRegistry, componentRegistry } = packageDependencies
    const journeyCode = packageInstance.getJourneyCode()
    let count = 0

    stepContexts.forEach(ctx => {
      const compiledStep = packageInstance.getCompiledStep(ctx.stepId)
      const runtimePlan = compiledStep.runtimePlan

      const accessPhase = createAccessLifecyclePhase(
        compiledStep.compiledAccessLifecycle,
        runtimePlan.path,
        functionRegistry,
        instrumentation,
      )

      const answersPhase = createAnswerPreparationPlanPhase(compiledStep.answerPreparationPlan, functionRegistry)

      const renderTerminal = createStepRenderTerminal(
        compiledStep.compiledRender,
        runtimePlan.path,
        this.routeTreeIndex.roots,
        ctx.routeTemplatePath,
        functionRegistry,
      )

      const getOrchestrator = new RequestOrchestrator(
        [
          accessPhase,
          answersPhase,
          createNavigationPhase(
            compiledStep.navigationPlan.compiledNavigation,
            compiledStep.navigationPlan,
            runtimePlan.stepId,
            ctx.routeTemplateCatalog,
            resolveStepRequestRedirect,
            functionRegistry,
            instrumentation,
          ),
          createEntryValidationPhase(
            compiledStep.compiledEntryValidation,
            compiledStep.validationPlan,
            runtimePlan.stepId,
            runtimePlan.path,
            functionRegistry,
            instrumentation,
          ),
        ],
        renderTerminal,
        instrumentation,
      )

      const postOrchestrator = new RequestOrchestrator(
        [
          accessPhase,
          answersPhase,
          createNavigationPhase(
            compiledStep.navigationPlan.compiledNavigation,
            compiledStep.navigationPlan,
            runtimePlan.stepId,
            ctx.routeTemplateCatalog,
            resolvePostRequestRedirect,
            functionRegistry,
            instrumentation,
          ),
          createSubmitPhase(
            compiledStep.compiledSubmitHooks,
            compiledStep.validationPlan,
            runtimePlan.stepId,
            runtimePlan.path,
            functionRegistry,
            instrumentation,
          ),
        ],
        renderTerminal,
        instrumentation,
      )

      const routeKey = ForgeEvaluator.scopedRouteKey(journeyCode, ctx.stepId)

      this.executorsByRouteKey.set(routeKey, {
        route: ctx.routeTemplatePath,
        journeyCode,
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
        title: stepRouteIndex.get(ctx.stepId)?.title,
      })

      count += 2
    })

    return count
  }

  private buildJourneyExecutors(
    journeyContexts: JourneyRouteContext[],
    journeyRouteIndex: JourneyRouteIndex,
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
    packageInstance: PackageInstance,
    packageDependencies: PackageDependencies,
  ): number {
    const { instrumentation } = this.forgeDependencies
    const { functionRegistry, componentRegistry } = packageDependencies
    const journeyCode = packageInstance.getJourneyCode()
    let count = 0

    journeyContexts.forEach(({ journeyId, templatePath }) => {
      const compiledJourney = packageInstance.getCompiledJourney(journeyId)
      const routeTemplateCatalog = catalogsByBasePath.get(templatePath)

      if (!compiledJourney || !routeTemplateCatalog) {
        return
      }

      const runtimePlan = compiledJourney.runtimePlan

      const orchestrator = new RequestOrchestrator(
        [
          createAccessLifecyclePhase(
            compiledJourney.compiledAccessLifecycle,
            runtimePlan.path,
            functionRegistry,
            instrumentation,
          ),
          createAnswerPreparationPlanPhase(compiledJourney.answerPreparationPlan, functionRegistry),
        ],
        createJourneyRedirectTerminal(
          compiledJourney.navigationPlan.compiledNavigation,
          compiledJourney.navigationPlan,
          routeTemplateCatalog,
          functionRegistry,
        ),
        instrumentation,
      )

      const routeKey = ForgeEvaluator.scopedRouteKey(journeyCode, journeyId)

      this.executorsByRouteKey.set(routeKey, {
        route: runtimePlan.path,
        journeyCode,
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
        title: journeyRouteIndex.get(journeyId)?.title,
      })

      count += 1
    })

    return count
  }

  private static scopedRouteKey(journeyCode: string, nodeId: NodeId): string {
    return `${journeyCode}::${nodeId}`
  }

  private errorOutcome(code: ForgeErrorCode, message: string): ForgeOutcome {
    return { kind: 'error', error: { code, message } }
  }
}
