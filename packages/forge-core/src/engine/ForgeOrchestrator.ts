import type Forge from './Forge'
import type { EvaluateOptions } from './Forge'
import type { ForgeDependencies } from './contracts/ast/engine.type'
import type { ForgeRenderer, RenderBlock, RenderContext } from '../framework/rendering/types'
import type { ComponentRegistry } from '../framework/types/adapter.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { ForgeErrorCode, ForgeOutcome } from '../framework/types/outcome.type'
import type { ForgeTopology } from '../framework/types/topology.type'
import type { ResponseBindings } from '../framework/types/responseBindings.type'
import { NO_OP_RESPONSE_BINDINGS } from '../framework/types/responseBindings.type'
import type { StoredRouteTree } from './contracts/routing/routeTree.type'
import type { MountedPackage } from './runtime/routes/MountRegistry'
import MountRegistryClass from './runtime/routes/MountRegistry'
import RequestOrchestrator from './runtime/orchestrator/RequestOrchestrator'
import type { PipelineState } from './runtime/orchestrator/types'
import { createAccessLifecyclePhase } from './runtime/orchestrator/phases/accessLifecyclePhase'
import { createAnswerPreparationPhase } from './runtime/orchestrator/phases/answerPreparationPhase'
import { createNavigationPhase } from './runtime/orchestrator/phases/navigationPhase'
import { createEntryValidationPhase } from './runtime/orchestrator/phases/entryValidationPhase'
import { createSubmitPhase } from './runtime/orchestrator/phases/submitPhase'
import { createStepRenderTerminal } from './runtime/orchestrator/terminals/stepRenderTerminal'
import { createJourneyRedirectTerminal } from './runtime/orchestrator/terminals/journeyRedirectTerminal'
import { resolveStepRequestRedirect, resolvePostRequestRedirect } from './runtime/navigation/navigationRedirects'
import SnapshotStepRequest from './runtime/snapshot/SnapshotStepRequest'
import ContextPreparer from './runtime/lifecycle/ContextPreparer'
import { isRenderBlock } from './runtime/rendering/typeguards'
import type { BlockDefinition, EvaluatedBlock } from '../components/types/structures.type'
import { StructureType } from '../authoring/types/enums'
import type { ValidationResult } from './contracts/runtime/validationResult.type'

export interface ForgeOrchestratorOptions<TOut = undefined> {
  readonly core: Forge
  readonly renderer?: ForgeRenderer<TOut>
}

interface NodeExecutor {
  readonly route: string
  readonly journeyCode: string
  readonly staticData: Record<string, unknown>
  readonly componentRegistry: ComponentRegistry
  readonly get?: RequestOrchestrator
  readonly post?: RequestOrchestrator
}

export default class ForgeOrchestrator<TOut = undefined> {
  private readonly forge: Forge

  private readonly renderer?: ForgeRenderer<TOut>

  private readonly contextPreparer = new ContextPreparer()

  private readonly executorsByRouteKey = new Map<string, NodeExecutor>()

  constructor(options: ForgeOrchestratorOptions<TOut>) {
    this.forge = options.core
    this.renderer = options.renderer

    const runtime = this.forge.getRuntime()
    const dependencies = this.forge.getDependencies()

    runtime.mounts.forEach(mount => {
      this.buildStepExecutors(mount, runtime.routeTreeRoots, dependencies)
      this.buildJourneyExecutors(mount, dependencies)
    })
  }

  getTopology(): ForgeTopology {
    return this.forge.getTopology()
  }

  async evaluate(snapshot: RequestSnapshot, options?: EvaluateOptions): Promise<ForgeOutcome<TOut>> {
    const executor = this.executorsByRouteKey.get(snapshot.nodeId)

    if (!executor) {
      return this.errorOutcome('node-not-found', `No route registered for node "${snapshot.nodeId}"`)
    }

    const orchestrator = snapshot.method === 'POST' ? executor.post : executor.get

    if (!orchestrator) {
      return this.errorOutcome('method-not-supported', `${snapshot.method} not allowed for node "${snapshot.nodeId}"`)
    }

    const dependencies = this.forge.getDependencies()

    dependencies.instrumentation.getCurrentSpan()?.setAttributes({
      'http.route': executor.route,
      'forge.journey.code': executor.journeyCode,
    })

    const request = new SnapshotStepRequest(snapshot)
    const context = this.contextPreparer.prepare({ staticData: executor.staticData }, request)
    const state: PipelineState = {
      context,
      request,
      responseBindings: options?.response ?? NO_OP_RESPONSE_BINDINGS,
    }

    const result = await orchestrator.execute(state)

    if (result.type === 'redirect') {
      return { kind: 'navigate', url: result.url }
    }

    if (this.renderer) {
      const output = this.renderOutput(result.context, executor.componentRegistry, options?.response)

      return {
        kind: 'render',
        context: result.context,
        componentRegistry: executor.componentRegistry,
        output,
      }
    }

    return {
      kind: 'render',
      context: result.context,
      componentRegistry: executor.componentRegistry,
    }
  }

  private renderOutput(
    renderContext: RenderContext,
    componentRegistry: ComponentRegistry,
    responseBindings?: ResponseBindings,
  ): TOut {
    const renderer = this.renderer!

    const visibleBlocks = renderContext.blocks.filter(
      block => isRenderBlock(block) && block.properties.visibleWhen !== false,
    )

    const renderedBlocks = visibleBlocks.map(block =>
      this.renderBlock(block, renderContext.showValidationFailures, componentRegistry, renderer),
    )

    const requestState = responseBindings ? {} : {}

    return renderer.assemblePage(renderContext, renderedBlocks, requestState)
  }

  private renderBlock(
    block: RenderBlock,
    showValidationFailures: boolean,
    componentRegistry: ComponentRegistry,
    renderer: ForgeRenderer<TOut>,
  ): TOut {
    const component = componentRegistry.get(block.variant)

    if (!component) {
      const availableVariants = Array.from(componentRegistry.getAll().keys())

      throw new Error(
        `Component variant "${block.variant}" not found in registry. ` +
          `Available variants: ${availableVariants.join(', ')}`,
      )
    }

    const transformedProperties = this.transformPropertiesWithRenderedBlocks(
      block.properties,
      showValidationFailures,
      componentRegistry,
      renderer,
    )

    const evaluatedBlock = this.toEvaluatedBlock(
      { ...block, properties: transformedProperties },
      showValidationFailures,
    )

    return component.render(evaluatedBlock, renderer) as TOut
  }

  private transformPropertiesWithRenderedBlocks(
    properties: Record<string, unknown>,
    showValidationFailures: boolean,
    componentRegistry: ComponentRegistry,
    renderer: ForgeRenderer<TOut>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    Object.entries(properties).forEach(([key, value]) => {
      result[key] = this.transformValue(value, showValidationFailures, componentRegistry, renderer)
    })

    return result
  }

  private transformValue(
    value: unknown,
    showValidationFailures: boolean,
    componentRegistry: ComponentRegistry,
    renderer: ForgeRenderer<TOut>,
  ): unknown {
    if (value === undefined) {
      return value
    }

    if (isRenderBlock(value)) {
      return this.renderNestedBlock(value as RenderBlock, showValidationFailures, componentRegistry, renderer)
    }

    if (Array.isArray(value)) {
      return value
        .map(element => this.transformValue(element, showValidationFailures, componentRegistry, renderer))
        .filter(item => item !== undefined)
    }

    if (typeof value === 'object' && value !== null) {
      return this.transformPropertiesWithRenderedBlocks(
        value as Record<string, unknown>,
        showValidationFailures,
        componentRegistry,
        renderer,
      )
    }

    return value
  }

  private renderNestedBlock(
    block: RenderBlock,
    showValidationFailures: boolean,
    componentRegistry: ComponentRegistry,
    renderer: ForgeRenderer<TOut>,
  ): unknown | undefined {
    if (block.properties.visibleWhen === false) {
      return undefined
    }

    const output = this.renderBlock(block, showValidationFailures, componentRegistry, renderer)
    const blockDefinition = {
      type: StructureType.BLOCK,
      blockType: block.blockType,
      variant: block.variant,
      ...block.properties,
    } as unknown as BlockDefinition

    return renderer.wrapNestedBlock(blockDefinition, output)
  }

  private toEvaluatedBlock(block: RenderBlock, showErrors: boolean): EvaluatedBlock<BlockDefinition> {
    const errors = showErrors ? this.extractErrors(block.properties.validWhen) : []

    return {
      type: StructureType.BLOCK,
      variant: block.variant,
      ...block.properties,
      errors,
    } as unknown as EvaluatedBlock<BlockDefinition>
  }

  private extractErrors(validate: unknown): { message: string; details?: Record<string, unknown> }[] {
    if (!Array.isArray(validate)) {
      return []
    }

    return (validate as ValidationResult[])
      .filter(result => !result.passed)
      .map(result => ({
        message: result.message,
        details: result.details,
      }))
  }

  private buildStepExecutors(
    mount: MountedPackage,
    routeTreeRoots: StoredRouteTree,
    forgeDependencies: ForgeDependencies,
  ): void {
    const { instrumentation } = forgeDependencies
    const { functionRegistry, componentRegistry } = mount.dependencies
    const { journeyCode, packageInstance, stepContexts } = mount

    stepContexts.forEach(ctx => {
      const compiledStep = packageInstance.getCompiledStep(ctx.stepId)
      const runtimePlan = compiledStep.runtimePlan

      const accessPhase = createAccessLifecyclePhase(
        compiledStep.compiledAccessLifecycle,
        runtimePlan.path,
        functionRegistry,
        instrumentation,
      )

      const answersPhase = createAnswerPreparationPhase(
        compiledStep.compiledAnswerPreparation,
        runtimePlan.path,
        functionRegistry,
      )

      const renderTerminal = createStepRenderTerminal(
        compiledStep.compiledRender,
        runtimePlan.path,
        routeTreeRoots,
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
            compiledStep.compiledValidation,
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
            compiledStep.compiledValidation,
            runtimePlan.stepId,
            runtimePlan.path,
            functionRegistry,
            instrumentation,
          ),
        ],
        renderTerminal,
        instrumentation,
      )

      const routeKey = MountRegistryClass.scopedRouteKey(journeyCode, ctx.stepId)

      this.executorsByRouteKey.set(routeKey, {
        route: ctx.routeTemplatePath,
        journeyCode,
        staticData: runtimePlan.staticData,
        componentRegistry,
        get: getOrchestrator,
        post: postOrchestrator,
      })
    })
  }

  private buildJourneyExecutors(mount: MountedPackage, forgeDependencies: ForgeDependencies): void {
    const { instrumentation } = forgeDependencies
    const { functionRegistry, componentRegistry } = mount.dependencies
    const { journeyCode, packageInstance, journeyContexts, catalogsByBasePath } = mount

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
          createAnswerPreparationPhase(compiledJourney.compiledAnswerPreparation, runtimePlan.path, functionRegistry),
        ],
        createJourneyRedirectTerminal(
          compiledJourney.navigationPlan.compiledNavigation,
          compiledJourney.navigationPlan,
          routeTemplateCatalog,
          functionRegistry,
        ),
        instrumentation,
      )

      const routeKey = MountRegistryClass.scopedRouteKey(journeyCode, journeyId)

      this.executorsByRouteKey.set(routeKey, {
        route: runtimePlan.path,
        journeyCode,
        staticData: runtimePlan.staticData,
        componentRegistry,
        get: orchestrator,
      })
    })
  }

  private errorOutcome(code: ForgeErrorCode, message: string): ForgeOutcome<TOut> {
    return { kind: 'error', error: { code, message } }
  }
}
