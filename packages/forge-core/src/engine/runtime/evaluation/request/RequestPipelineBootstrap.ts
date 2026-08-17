import type { ForgeRenderer } from '../../../../framework/types/rendering.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { ValidationRuleFilter } from '../../../concerns/validation/contracts/ValidationWork.type'
import type { HttpMethod } from '../../../../framework/types/request.type'
import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import type { MountedNode, MountedStepNode } from '../../../registries/MountRegistry'
import { buildStepValidationTask } from '../../../concerns/validation/runtime/stepValidationStore'
import type { PipelineState } from '../../../contracts/runtime/RequestExecution.type'
import type { WorkTask } from '../../../contracts/runtime/work.type'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import WorkTaskFactory from '../work/WorkTaskFactory'

export interface RequestPipelineConfig {
  readonly method: HttpMethod
  readonly node: MountedNode
  readonly snapshot: RequestSnapshot
  readonly renderer?: ForgeRenderer<unknown>
  readonly traceEnabled: boolean
}

export default class RequestPipelineBootstrap {
  constructor(private readonly config: RequestPipelineConfig) {}

  buildPipelineElement(): WorkTask {
    return WorkTaskFactory.requestPipeline({
      phases: this.buildPhases(),
    })
  }

  buildExecutionContext(state: PipelineState): RequestExecutionContext {
    const { node } = this.config
    const { functionRegistry, componentRegistry, compiledStepValidations } = node
    const compiledValidation = node.kind === 'step' ? node.compiledValidation : undefined

    const buildStepValidation = (stepId: NodeId, filter: ValidationRuleFilter) =>
      buildStepValidationTask(
        compiledStepValidations.get(stepId) ?? compiledValidation,
        stepId,
        state.context,
        functionRegistry,
        filter,
      )

    return {
      context: state.context,
      responseBindings: state.responseBindings,
      functionRegistry,
      componentRegistry,
      currentStepId: node.kind === 'step' ? node.nodeId : undefined,
      hasRenderer: this.config.renderer !== undefined,
      traceEnabled: this.config.traceEnabled,
      buildStepValidation,
    }
  }

  private buildPhases(): readonly WorkTask[] {
    const { method, node, snapshot } = this.config

    const contextPreparation = WorkTaskFactory.contextPreparation({
      compiledStaticData: node.compiledStaticData,
      snapshot,
    })

    const access = WorkTaskFactory.requestAccess({
      compiled: node.compiledAccessLifecycle,
      path: node.path,
    })

    const answerPreparation = WorkTaskFactory.requestAnswerPreparation({
      compiled: node.compiledAnswerPreparation,
      path: node.path,
    })

    const validities = WorkTaskFactory.requestValidities({
      compiledStepValidations: node.compiledStepValidations,
    })

    const reachability = WorkTaskFactory.requestReachability({
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

    const answerCleardown = WorkTaskFactory.requestAnswerCleardown({})

    const routeTree = WorkTaskFactory.requestRouteTree({
      compiled: stepNode.compiledRouteMetadata,
      path: node.path,
      routeTree: stepNode.routeTree,
      currentRouteTemplatePath: stepNode.templatePath,
    })

    const resolve = WorkTaskFactory.requestResolve({
      compiled: stepNode.compiledResolve,
      path: node.path,
    })

    const terminalPhases = this.buildTerminalPhases(routeTree, resolve, stepNode)

    if (method === 'POST') {
      const submit = WorkTaskFactory.requestSubmit({
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

    const entryValidation = WorkTaskFactory.requestEntryValidation({
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

    const render = WorkTaskFactory.requestRender({
      renderer,
      componentRegistry: stepNode.componentRegistry,
    })

    return [routeTree, resolve, render]
  }
}
