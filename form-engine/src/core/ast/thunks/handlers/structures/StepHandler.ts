import { NodeId } from '@form-engine/core/types/engine.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluatePropertyValue } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Handler for Step structure nodes
 *
 * Evaluates properties in the step based on whether it's the current step:
 *
 * For CURRENT STEP (isCurrentStep = true) or ANCESTOR steps (isAncestorOfStep = true):
 * - All properties except transitions (handled by FormStepController)
 *
 * For OTHER STEPS:
 * - Only navigation/validation properties: path, title, description, isEntryPoint, blocks, metadata
 * - Rendering properties are skipped
 *
 * This runtime filtering replaces compile-time filtering in findRelevantNodes,
 * allowing thunks to be compiled once and shared across all step artefacts.
 *
 * Synchronous when all nested AST nodes in properties are sync.
 * Asynchronous when any nested AST node is async.
 */
export default class StepHandler implements HybridThunkHandler {
  isAsync = true

  // Transition properties are handled separately by FormStepController
  private static readonly TRANSITION_PROPS = ['onLoad', 'onAccess', 'onAction', 'onSubmission']

  // Properties needed for navigation/validation on non-current steps
  private static readonly NAVIGATION_PROPS = ['path', 'title', 'isEntryPoint', 'description', 'blocks', 'metadata']

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: StepASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const isCurrentStep = deps.metadataRegistry.get(this.nodeId, 'isCurrentStep', false)
    const isAncestorOfStep = deps.metadataRegistry.get(this.nodeId, 'isAncestorOfStep', false)

    // Determine which properties to check based on step context
    const propertiesToCheck =
      isCurrentStep || isAncestorOfStep
        ? Object.entries(this.node.properties).filter(([key]) => !StepHandler.TRANSITION_PROPS.includes(key))
        : Object.entries(this.node.properties).filter(([key]) => StepHandler.NAVIGATION_PROPS.includes(key))

    const asyncProperties: string[] = []

    propertiesToCheck.forEach(([key, value]) => {
      if (this.containsAsyncNodes(value, deps)) {
        asyncProperties.push(key)
      }
    })

    this.isAsync = asyncProperties.length > 0
  }

  private containsAsyncNodes(value: unknown, deps: MetadataComputationDependencies): boolean {
    if (value === null || value === undefined) {
      return false
    }

    if (isASTNode(value)) {
      const handler = deps.thunkHandlerRegistry.get(value.id)

      return handler?.isAsync ?? true
    }

    if (Array.isArray(value)) {
      return value.some(item => this.containsAsyncNodes(item, deps))
    }

    if (typeof value === 'object') {
      return Object.values(value).some(prop => this.containsAsyncNodes(prop, deps))
    }

    return false
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const propertiesToEvaluate = this.getPropertiesToEvaluate(context)
    const evaluatedProperties = this.evaluatePropertyValueSync(propertiesToEvaluate, context, invoker)

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
    const evaluatedProperties = await evaluatePropertyValue(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        properties: evaluatedProperties,
      },
    }
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

  private evaluatePropertyValueSync(
    value: unknown,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (isASTNode(value)) {
      if (!context.nodeRegistry.has(value.id)) {
        return undefined
      }

      const result = invoker.invokeSync(value.id, context)

      return result.error ? undefined : result.value
    }

    if (Array.isArray(value)) {
      return value.map(item => this.evaluatePropertyValueSync(item, context, invoker)).filter(v => v !== undefined)
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {}

      Object.entries(value).forEach(([key, val]) => {
        result[key] = this.evaluatePropertyValueSync(val, context, invoker)
      })

      return result
    }

    return value
  }
}
