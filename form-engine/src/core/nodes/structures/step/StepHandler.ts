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
export default class StepHandler implements ThunkHandler {
  isAsync = true

  // Transition properties are handled separately by FormStepController
  private static readonly TRANSITION_PROPS = ['onLoad', 'onAccess', 'onAction', 'onSubmission']

  private static readonly TRANSITION_PROPS_SET = new Set(StepHandler.TRANSITION_PROPS)

  // Properties needed for navigation/validation on non-current steps
  private static readonly NAVIGATION_PROPS = ['path', 'title', 'isEntryPoint', 'description', 'blocks', 'metadata']

  private static readonly NAVIGATION_PROPS_SET = new Set(StepHandler.NAVIGATION_PROPS)

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: StepASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const isCurrentStep = deps.metadataRegistry.get(this.nodeId, 'isCurrentStep', false)
    const isAncestorOfStep = deps.metadataRegistry.get(this.nodeId, 'isAncestorOfStep', false)
    const isCurrentOrAncestor = isCurrentStep || isAncestorOfStep
    const properties = this.node.properties as Record<string, unknown>

    // eslint-disable-next-line no-restricted-syntax -- for...in avoids Object.keys() allocation in this hot path
    for (const key in properties) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        continue // eslint-disable-line no-continue
      }

      const isRelevant = isCurrentOrAncestor
        ? !StepHandler.TRANSITION_PROPS_SET.has(key)
        : StepHandler.NAVIGATION_PROPS_SET.has(key)

      if (!isRelevant) {
        continue // eslint-disable-line no-continue
      }

      if (this.containsAsyncNodes(properties[key], deps)) {
        this.isAsync = true
        return
      }
    }

    this.isAsync = false
  }

  private containsAsyncNodes(root: unknown, deps: MetadataComputationDependencies): boolean {
    const stack: unknown[] = [root]

    while (stack.length > 0) {
      const value = stack.pop()

      if (value === null || value === undefined) {
        continue // eslint-disable-line no-continue
      }

      if (isASTNode(value)) {
        const handler = deps.thunkHandlerRegistry.get(value.id)

        if (handler?.isAsync ?? true) {
          return true
        }

        continue // eslint-disable-line no-continue
      }

      if (Array.isArray(value)) {
        value.forEach(item => stack.push(item))
        continue // eslint-disable-line no-continue
      }

      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>

        // eslint-disable-next-line no-restricted-syntax -- for...in avoids Object.values() allocation in this hot path
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            stack.push(obj[key])
          }
        }
      }
    }

    return false
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const propertiesToEvaluate = this.getPropertiesToEvaluate(context)
    const evaluatedProperties = evaluatePropertyValueSync(propertiesToEvaluate, context, invoker)

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
}
