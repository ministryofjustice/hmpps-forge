import type { ForgeRenderer } from '../../../../framework/rendering/types'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { StepValidityResult } from '../../../contracts/runtime/stepValidityResult.type'
import type { HttpMethod } from '../../../../framework/types/request.type'
import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import type { MountedNode, MountedStepNode } from '../../../registries/MountRegistry'
import { buildStepValidationTask, recordStepValidationState } from '../phases/validation/stepValidationStore'
import type { PipelineState } from '../../../contracts/runtime/RequestExecution.type'
import type { WorkTask } from '../../../contracts/runtime/work.type'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import WorkTaskFactory from '../work/WorkTaskFactory'

export interface RequestPipelineConfig {
  readonly method: HttpMethod
  readonly node: MountedNode
  readonly snapshot: RequestSnapshot
  readonly renderer?: ForgeRenderer<unknown>
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
    const { functionRegistry, compiledStepValidations } = node
    const compiledValidation = node.kind === 'step' ? node.compiledValidation : undefined

    const buildStepValidation = (stepId: NodeId, isSubmission: boolean) =>
      buildStepValidationTask(
        compiledStepValidations.get(stepId) ?? compiledValidation,
        stepId,
        state.context,
        functionRegistry,
        isSubmission,
      )

    const recordStepValidation = (stepId: NodeId, result: StepValidityResult): void =>
      recordStepValidationState(state.context, stepId, result)

    return {
      context: state.context,
      responseBindings: state.responseBindings,
      functionRegistry,
      currentStepId: node.kind === 'step' ? node.nodeId : undefined,
      hasRenderer: this.config.renderer !== undefined,
      buildStepValidation,
      recordStepValidation,
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
      compiledNavigation: node.navigationPlan.compiledNavigation,
      navigationPlan: node.navigationPlan,
      routeTemplateCatalog: node.routeTemplateCatalog,
      method,
    })

    if (node.kind === 'journey') {
      return [contextPreparation, access, answerPreparation, validities, reachability]
    }

    const stepNode = node as MountedStepNode

    const answerCleardown = WorkTaskFactory.requestAnswerCleardown({
      navigationPlan: node.navigationPlan,
    })

    const resolve = WorkTaskFactory.requestResolve({
      compiled: stepNode.compiledResolve,
      path: node.path,
      routeTree: stepNode.routeTree,
      currentRouteTemplatePath: stepNode.templatePath,
    })

    const terminalPhases = this.buildTerminalPhases(resolve, stepNode)

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

  private buildTerminalPhases(resolve: WorkTask, stepNode: MountedStepNode): readonly WorkTask[] {
    const { renderer } = this.config

    if (!renderer) {
      return [resolve]
    }

    const render = WorkTaskFactory.requestRender({
      renderer,
      componentRegistry: stepNode.componentRegistry,
    })

    return [resolve, render]
  }
}
