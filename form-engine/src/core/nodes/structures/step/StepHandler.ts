import { NodeId } from '@form-engine/core/types/engine.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { evaluatePropertyValue } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluatePropertyValueSync } from '@form-engine/core/utils/thunkEvaluatorsSync'

/**
 * Handler for Step structure nodes
 *
 * Evaluates properties in the step based on whether it's the current step:
 *
 * For CURRENT STEP (isCurrentStep = true) or ANCESTOR steps (isAncestorOfStep = true):
 * - All properties except transitions (handled by FormStepController)
 *
 * For OTHER STEPS:
 * - Only navigation/validation properties: path, code, title, description, isEntryPoint, blocks, metadata
 * - Rendering properties are skipped
 *
 * This runtime filtering replaces compile-time filtering in findRelevantNodes,
 * allowing thunks to be compiled once and shared across all step artefacts.
 *
 * Synchronous when all nested AST nodes in properties are sync.
 * Asynchronous when any nested AST node is async.
 */
export default class StepHandler implements ThunkHandler {
  isAsync = false

  private propertiesWithNodes: ReadonlySet<string> | undefined

  // Transition properties are handled separately by FormStepController
  private static readonly TRANSITION_PROPS = ['onLoad', 'onAccess', 'onAction', 'onSubmission']

  private static readonly TRANSITION_PROPS_SET = new Set(StepHandler.TRANSITION_PROPS)

  // Properties needed for navigation/validation on non-current steps
  private static readonly NAVIGATION_PROPS = [
    'path',
    'code',
    'title',
    'isEntryPoint',
    'description',
    'blocks',
    'metadata',
  ]

  private static readonly NAVIGATION_PROPS_SET = new Set(StepHandler.NAVIGATION_PROPS)

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: StepASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const isCurrentStep = deps.metadataRegistry.get(this.nodeId, 'isCurrentStep', false)
    const isAncestorOfStep = deps.metadataRegistry.get(this.nodeId, 'isAncestorOfStep', false)
    const isCurrentOrAncestor = isCurrentStep || isAncestorOfStep
    const propertiesWithNodes = new Set<string>()
    let hasAsync = false

    deps.astNodeTree.getChildren(this.nodeId).forEach(childId => {
      const property = deps.metadataRegistry.get<string>(childId, 'attachedToParentProperty')

      if (!property) {
        return
      }

      propertiesWithNodes.add(property)

      if (hasAsync) {
        return
      }

      const isRelevant = isCurrentOrAncestor
        ? !StepHandler.TRANSITION_PROPS_SET.has(property)
        : StepHandler.NAVIGATION_PROPS_SET.has(property)

      if (!isRelevant) {
        return
      }

      const handler = deps.thunkHandlerRegistry.get(childId)

      if (handler?.isAsync ?? true) {
        hasAsync = true
      }
    })

    this.isAsync = hasAsync
    this.propertiesWithNodes = propertiesWithNodes
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const propertiesToEvaluate = this.getPropertiesToEvaluate(context)
    const evaluatedProperties = this.evaluatePropertiesSync(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        properties: evaluatedProperties,
      },
    }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const propertiesToEvaluate = this.getPropertiesToEvaluate(context)
    const evaluatedProperties = await this.evaluateProperties(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        properties: evaluatedProperties,
      },
    }
  }

  private evaluatePropertiesSync(
    properties: Record<string, unknown>,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    Object.entries(properties).forEach(([key, value]) => {
      if (this.propertiesWithNodes && !this.propertiesWithNodes.has(key)) {
        result[key] = value
        return
      }

      result[key] = evaluatePropertyValueSync(value, context, invoker)
    })

    return result
  }

  private async evaluateProperties(
    properties: Record<string, unknown>,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}

    await Promise.all(
      Object.entries(properties).map(async ([key, value]) => {
        if (this.propertiesWithNodes && !this.propertiesWithNodes.has(key)) {
          result[key] = value
          return
        }

        result[key] = await evaluatePropertyValue(value, context, invoker)
      }),
    )

    return result
  }

  /**
   * Determine which properties to evaluate based on step context
   *
   * Current/ancestor steps: all properties except transitions
   * Other steps: only navigation/validation properties
   */
  private getPropertiesToEvaluate(context: ThunkEvaluationContext): Record<string, unknown> {
    const isCurrentStep = context.metadataRegistry.get(this.nodeId, 'isCurrentStep', false)
    const isAncestorOfStep = context.metadataRegistry.get(this.nodeId, 'isAncestorOfStep', false)

    // Always exclude transition properties - they're handled by FormStepController
    const excludeTransitions = ([key]: [string, unknown]) => !StepHandler.TRANSITION_PROPS.includes(key)

    if (isCurrentStep || isAncestorOfStep) {
      // Current or ancestor step: all non-transition properties
      return Object.fromEntries(Object.entries(this.node.properties).filter(excludeTransitions))
    }

    // Other steps: only navigation/validation properties
    return Object.fromEntries(
      Object.entries(this.node.properties).filter(
        ([key]) => StepHandler.NAVIGATION_PROPS.includes(key) && !StepHandler.TRANSITION_PROPS.includes(key),
      ),
    )
  }
}
