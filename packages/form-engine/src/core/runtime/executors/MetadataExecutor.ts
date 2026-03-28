import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { evaluatePropertyValue } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluatePropertyValueSync } from '@form-engine/core/utils/thunkEvaluatorsSync'
import { JourneyAncestor, RenderContext } from '@form-engine/core/runtime/rendering/types'

export interface MetadataExecutionResult {
  step: RenderContext['step']
  ancestors: JourneyAncestor[]
}

/**
 * MetadataExecutor - Evaluates page chrome data for the current step
 *
 * This targets only journey ancestor metadata and current-step metadata.
 * It intentionally does not evaluate the current step's block tree.
 */
export default class MetadataExecutor {
  private static readonly STEP_EXCLUDED_PROPS = new Set(['onAccess', 'onAction', 'onSubmission', 'blocks'])

  private static readonly JOURNEY_EXCLUDED_PROPS = new Set(['onAccess', 'children', 'steps'])

  constructor() {}

  async execute(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<MetadataExecutionResult> {
    const stepNode = this.getStepNode(runtimePlan.renderStepId, context)
    const ancestorNodes = this.getAncestorNodes(runtimePlan.renderAncestorIds, context)

    const [step, ancestors] = await Promise.all([
      this.evaluateStepMetadata(stepNode, invoker, context),
      Promise.all(ancestorNodes.map(node => this.evaluateJourneyMetadata(node, invoker, context))),
    ])

    return {
      step,
      ancestors,
    }
  }

  executeSync(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): MetadataExecutionResult {
    const stepNode = this.getStepNode(runtimePlan.renderStepId, context)
    const ancestorNodes = this.getAncestorNodes(runtimePlan.renderAncestorIds, context)

    const stepProperties = this.filterStepProperties(stepNode)
    const step = evaluatePropertyValueSync(stepProperties, context, invoker) as RenderContext['step']

    const ancestors = ancestorNodes.map(node => {
      const properties = this.filterJourneyProperties(node)

      return evaluatePropertyValueSync(properties, context, invoker) as JourneyAncestor
    })

    return { step, ancestors }
  }

  private getStepNode(stepId: StepRuntimePlan['renderStepId'], context: ThunkEvaluationContext): StepASTNode {
    const node = context.nodeRegistry.get(stepId) as StepASTNode | undefined

    if (!node) {
      throw new Error(`Step not found for metadata evaluation: ${stepId}`)
    }

    return node
  }

  private getAncestorNodes(
    ancestorIds: StepRuntimePlan['renderAncestorIds'],
    context: ThunkEvaluationContext,
  ): JourneyASTNode[] {
    return ancestorIds.map(ancestorId => {
      const node = context.nodeRegistry.get(ancestorId) as JourneyASTNode | undefined

      if (!node) {
        throw new Error(`Journey ancestor not found for metadata evaluation: ${ancestorId}`)
      }

      return node
    })
  }

  private filterStepProperties(stepNode: StepASTNode): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(stepNode.properties).filter(([key]) => !MetadataExecutor.STEP_EXCLUDED_PROPS.has(key)),
    )
  }

  private filterJourneyProperties(journeyNode: JourneyASTNode): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(journeyNode.properties).filter(([key]) => !MetadataExecutor.JOURNEY_EXCLUDED_PROPS.has(key)),
    )
  }

  private async evaluateStepMetadata(
    stepNode: StepASTNode,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<RenderContext['step']> {
    return (await evaluatePropertyValue(this.filterStepProperties(stepNode), context, invoker)) as RenderContext['step']
  }

  private async evaluateJourneyMetadata(
    journeyNode: JourneyASTNode,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<JourneyAncestor> {
    return (await evaluatePropertyValue(this.filterJourneyProperties(journeyNode), context, invoker)) as JourneyAncestor
  }
}
