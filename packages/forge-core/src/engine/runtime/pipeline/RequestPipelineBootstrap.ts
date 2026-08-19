import type { ForgeRenderer } from '../../../framework/types/rendering.type'
import type { NodeId } from '../../contracts/ast/ast.type'
import type { ValidationRuleFilter } from '../../concerns/validation/contracts/ValidationWork.type'
import type { HttpMethod } from '../../../framework/types/request.type'
import type { RequestSnapshot } from '../../../framework/types/snapshot.type'
import type { MountedNode, MountedStepNode } from '../../registries/MountRegistry'
import { buildStepValidationTask } from '../../concerns/validation/runtime/stepValidationStore'
import type { WorkTask } from '../../contracts/work/work.type'
import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import RequestState from './RequestState'
import { createRequestPipelineTask } from './RequestPipelineWorkHandler'
import { createRequestContextPreparationTask } from './RequestContextPreparationWorkHandler'
import { createRequestAccessTask } from '../../concerns/hooks/runtime/RequestAccessWorkHandler'
import { createRequestAnswerPreparationTask } from '../../concerns/answer-preparation/runtime/RequestAnswerPreparationWorkHandler'
import { createReachabilityValiditiesTask } from '../../concerns/validation/runtime/ReachabilityValiditiesWorkHandler'
import { createRequestReachabilityTask } from '../../concerns/reachability/runtime/RequestReachabilityWorkHandler'
import { createRequestAnswerCleardownTask } from '../../concerns/answer-cleardown/runtime/RequestAnswerCleardownWorkHandler'
import { createRequestSubmitTask } from '../../concerns/hooks/runtime/RequestSubmitWorkHandler'
import { createRequestEntryValidationTask } from '../../concerns/validation/runtime/RequestEntryValidationWorkHandler'
import { createRequestResolveTask } from '../../concerns/resolve/runtime/RequestResolveWorkHandler'
import { createRequestRouteTreeTask } from '../../concerns/route/runtime/RequestRouteTreeWorkHandler'
import { createRequestRenderTask } from '../../concerns/render/runtime/RequestRenderWorkHandler'

export interface RequestPipelineConfig {
  readonly method: HttpMethod
  readonly node: MountedNode
  readonly snapshot: RequestSnapshot
  readonly renderer?: ForgeRenderer<unknown>
  readonly traceEnabled: boolean
  readonly responseBindings: ResponseBindings
}

export default class RequestPipelineBootstrap {
  constructor(private readonly config: RequestPipelineConfig) {}

  buildPipelineElement(): WorkTask {
    return createRequestPipelineTask({
      phases: this.buildPhases(),
    })
  }

  buildExecutionContext(): RequestState {
    const { node } = this.config
    const { functionRegistry, componentRegistry, compiledStepValidations } = node
    const compiledValidation = node.kind === 'step' ? node.compiledValidation : undefined

    const context = {
      request: {},
      domain: {
        data: {},
        answers: {},
      },
      evaluation: {},
    } as RuntimeContext

    const buildStepValidation = (stepId: NodeId, filter: ValidationRuleFilter) =>
      buildStepValidationTask(
        compiledStepValidations.get(stepId) ?? compiledValidation,
        stepId,
        context,
        functionRegistry,
        filter,
      )

    return new RequestState(context, {
      responseBindings: this.config.responseBindings,
      functionRegistry,
      componentRegistry,
      currentStepId: node.kind === 'step' ? node.nodeId : undefined,
      hasRenderer: this.config.renderer !== undefined,
      traceEnabled: this.config.traceEnabled,
      buildStepValidation,
    })
  }

  private buildPhases(): readonly WorkTask[] {
    const { method, node, snapshot } = this.config

    const contextPreparation = createRequestContextPreparationTask({
      compiledStaticData: node.compiledStaticData,
      snapshot,
    })

    const access = createRequestAccessTask({
      compiled: node.compiledAccessLifecycle,
      path: node.path,
    })

    const answerPreparation = createRequestAnswerPreparationTask({
      compiled: node.compiledAnswerPreparation,
      path: node.path,
    })

    const validities = createReachabilityValiditiesTask({
      compiledStepValidations: node.compiledStepValidations,
    })

    const reachability = createRequestReachabilityTask({
      mode: node.kind,
      compiledReachabilityFacts: node.compiledReachabilityFacts,
      compiledReachabilityState: node.compiledReachabilityState,
      compiledFieldInventory: node.compiledFieldInventory,
      routeTemplateCatalog: node.routeTemplateCatalog,
      method,
    })

    if (node.kind === 'journey') {
      return [contextPreparation, access, answerPreparation, validities, reachability]
    }

    const stepNode = node as MountedStepNode

    const answerCleardown = createRequestAnswerCleardownTask({})

    const routeTree = createRequestRouteTreeTask({
      compiled: stepNode.compiledRouteMetadata,
      path: node.path,
      routeTree: stepNode.routeTree,
      currentRouteTemplatePath: stepNode.templatePath,
    })

    const resolve = createRequestResolveTask({
      compiled: stepNode.compiledResolve,
      path: node.path,
    })

    const terminalPhases = this.buildTerminalPhases(routeTree, resolve, stepNode)

    if (method === 'POST') {
      const submit = createRequestSubmitTask({
        compiled: stepNode.compiledSubmitHooks,
        path: node.path,
      })

      return [
        contextPreparation,
        access,
        answerPreparation,
        validities,
        reachability,
        answerCleardown,
        submit,
        ...terminalPhases,
      ]
    }

    const entryValidation = createRequestEntryValidationTask({
      compiled: stepNode.compiledEntryValidation,
      path: node.path,
    })

    return [
      contextPreparation,
      access,
      answerPreparation,
      validities,
      reachability,
      answerCleardown,
      entryValidation,
      ...terminalPhases,
    ]
  }

  private buildTerminalPhases(routeTree: WorkTask, resolve: WorkTask, stepNode: MountedStepNode): readonly WorkTask[] {
    const { renderer } = this.config

    if (!renderer) {
      return [routeTree, resolve]
    }

    const render = createRequestRenderTask({
      renderer,
      componentRegistry: stepNode.componentRegistry,
    })

    return [routeTree, resolve, render]
  }
}
