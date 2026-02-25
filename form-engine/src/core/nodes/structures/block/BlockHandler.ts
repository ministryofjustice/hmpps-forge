import { NodeId } from '@form-engine/core/types/engine.type'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
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
 * Handler for Block structure nodes (both field and basic blocks)
 *
 * Evaluates properties in the block based on whether it's on the current step:
 *
 * For blocks on CURRENT STEP (isDescendantOfStep = true):
 * - All properties are evaluated (rendering, validation, etc.)
 *
 * For blocks on OTHER STEPS:
 * - Only validation/data properties: code, validate, dependent
 * - Rendering properties (label, hint, items, etc.) are skipped
 *
 * This runtime filtering replaces compile-time filtering in findRelevantNodes,
 * allowing thunks to be compiled once and shared across all step artefacts.
 *
 * Synchronous when all nested AST nodes in properties are sync.
 * Asynchronous when any nested AST node is async.
 */
export default class BlockHandler implements ThunkHandler {
  isAsync = true

  // Properties needed for validation/data on non-current steps
  private static readonly VALIDATION_PROPS = ['code', 'validate', 'dependent']

  private static readonly VALIDATION_PROPS_SET = new Set(BlockHandler.VALIDATION_PROPS)

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: BlockASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const isOnCurrentStep = deps.metadataRegistry.get(this.nodeId, 'isDescendantOfStep', false)
    const properties = this.node.properties as Record<string, unknown>

    // eslint-disable-next-line no-restricted-syntax -- for...in avoids Object.keys() allocation in this hot path
    for (const key in properties) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        continue // eslint-disable-line no-continue
      }

      const isRelevant = isOnCurrentStep ? key !== 'formatters' : BlockHandler.VALIDATION_PROPS_SET.has(key)

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

  /**
   * Recursively check if a value contains any async AST nodes
   */
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
    const evaluatedProperties = this.evaluateBlockPropertiesSync(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        variant: this.node.variant,
        blockType: this.node.blockType,
        properties: evaluatedProperties,
      },
    }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const propertiesToEvaluate = this.getPropertiesToEvaluate(context)
    const evaluatedProperties = await this.evaluateBlockProperties(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        variant: this.node.variant,
        blockType: this.node.blockType,
        properties: evaluatedProperties,
      },
    }
  }

  /**
   * Determine which properties to evaluate based on step context
   *
   * Current step blocks: all properties (for full rendering)
   * Other step blocks: only validation properties (for cross-step validation)
   */
  private getPropertiesToEvaluate(context: ThunkEvaluationContext): Record<string, unknown> {
    const isOnCurrentStep = context.metadataRegistry.get(this.nodeId, 'isDescendantOfStep', false)

    if (isOnCurrentStep) {
      return this.node.properties
    }

    // For blocks on other steps, only include validation/data properties
    return Object.fromEntries(
      Object.entries(this.node.properties).filter(([key]) => BlockHandler.VALIDATION_PROPS.includes(key)),
    )
  }

  /**
   * Sync version: Evaluate block properties with special handling for dependent/validate relationship
   */
  private evaluateBlockPropertiesSync(
    properties: Record<string, unknown>,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Record<string, unknown> {
    // First, check if there's a dependent property
    const hasDependentProperty = 'dependent' in properties
    let isDependentActive = true

    if (hasDependentProperty) {
      const dependentValue = evaluatePropertyValueSync(properties.dependent, context, invoker)
      isDependentActive = Boolean(dependentValue)
    }

    // Evaluate all properties
    const result: Record<string, unknown> = {}

    Object.entries(properties).forEach(([key, value]) => {
      // Skip validation evaluation if dependent is false
      if (key === 'validate' && !isDependentActive) {
        result[key] = []
        return
      }

      // Skip formatters - they are applied during submission, not rendering
      if (key === 'formatters') {
        result[key] = value
        return
      }

      result[key] = evaluatePropertyValueSync(value, context, invoker)
    })

    return result
  }

  /**
   * Evaluate block properties with special handling for dependent/validate relationship
   *
   * If a block has a 'dependent' property that evaluates to false, the 'validate'
   * property will not be evaluated (returns empty array instead).
   */
  private async evaluateBlockProperties(
    properties: Record<string, unknown>,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<Record<string, unknown>> {
    // First, check if there's a dependent property
    const hasDependentProperty = 'dependent' in properties
    let isDependentActive = true

    if (hasDependentProperty) {
      const dependentValue = await evaluatePropertyValue(properties.dependent, context, invoker)
      isDependentActive = Boolean(dependentValue)
    }

    // Evaluate all properties
    const result: Record<string, unknown> = {}

    await Promise.all(
      Object.entries(properties).map(async ([key, value]) => {
        // Skip validation evaluation if dependent is false
        if (key === 'validate' && !isDependentActive) {
          result[key] = []
          return
        }

        // Skip formatters - they are applied during submission, not rendering
        if (key === 'formatters') {
          result[key] = value
          return
        }

        result[key] = await evaluatePropertyValue(value, context, invoker)
      }),
    )

    return result
  }
}
