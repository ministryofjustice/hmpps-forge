import { NodeId } from '@form-engine/core/types/engine.type'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
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
export default class BlockHandler implements HybridThunkHandler {
  isAsync = true

  // Properties needed for validation/data on non-current steps
  private static readonly VALIDATION_PROPS = ['code', 'validate', 'dependent']

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: BlockASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const isOnCurrentStep = deps.metadataRegistry.get(this.nodeId, 'isDescendantOfStep', false)

    // For blocks on current step: check ALL properties except formatters (which aren't evaluated during rendering)
    // For blocks on other steps: only check validation properties
    const propertiesToCheck = isOnCurrentStep
      ? Object.entries(this.node.properties).filter(([key]) => key !== 'formatters')
      : Object.entries(this.node.properties).filter(([key]) => BlockHandler.VALIDATION_PROPS.includes(key))

    const asyncProperties: string[] = []

    propertiesToCheck.forEach(([key, value]) => {
      if (this.containsAsyncNodes(value, deps)) {
        asyncProperties.push(key)
      }
    })

    this.isAsync = asyncProperties.length > 0
  }

  /**
   * Recursively check if a value contains any async AST nodes
   */
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
      const dependentValue = this.evaluatePropertyValueSync(properties.dependent, context, invoker)
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

      result[key] = this.evaluatePropertyValueSync(value, context, invoker)
    })

    return result
  }

  /**
   * Sync version: Recursively evaluate a property value
   */
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
