import { NodeId } from '@form-engine/core/types/engine.type'
import { PostPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { ThunkHandler, HandlerResult } from '@form-engine/core/compilation/thunks/types'
import { isSafePropertyKey } from '@form-engine/core/utils/propertyAccess'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'

/**
 * Handler for POST pseudo nodes
 *
 * Returns form submission data from context.post using the base field code.
 *
 * When field.multiple is false (default), arrays are reduced to the first non-empty value.
 * When field.multiple is true, all values in the array are kept.
 *
 * Nested property access is handled by Reference expression handlers.
 */
export default class PostHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: PostPseudoNode,
  ) {}

  computeIsAsync(): void {
    this.isAsync = false
  }

  async evaluate(context: ThunkEvaluationContext): Promise<HandlerResult> {
    return this.evaluateSync(context)
  }

  evaluateSync(context: ThunkEvaluationContext): HandlerResult {
    const { baseFieldCode, fieldNodeId } = this.pseudoNode.properties

    // Validate field code is safe before using as property key
    if (!isSafePropertyKey(baseFieldCode)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, baseFieldCode, PseudoNodeType.POST)

      return { error: error.toThunkError() }
    }

    // If field isn't in POST at all, return undefined
    if (!Object.hasOwn(context.request.post, baseFieldCode)) {
      return { value: undefined }
    }

    // Read raw POST value from context
    const rawValue = context.request.post[baseFieldCode]

    // Apply multiple behavior if we have a field reference
    const value = this.applyMultipleBehavior(rawValue, fieldNodeId, context)

    return { value }
  }

  /**
   * Apply the multiple behavior to a value
   *
   * When multiple is false (default), arrays are reduced to the first non-empty value.
   * When multiple is true, all values in the array are kept as-is.
   */
  private applyMultipleBehavior(
    value: unknown,
    fieldNodeId: NodeId | undefined,
    context: ThunkEvaluationContext,
  ): unknown {
    // If no field reference, default to extracting first non-empty value from arrays
    if (!fieldNodeId) {
      return Array.isArray(value) ? this.getFirstNonEmpty(value) : value
    }

    const fieldNode = context.nodeRegistry.get(fieldNodeId) as FieldBlockASTNode

    // If field has multiple: true, always return an array
    if (fieldNode.properties.multiple) {
      if (Array.isArray(value)) {
        return value
      }

      // Normalize single value to array (or empty array if undefined/null)
      return value !== undefined && value !== null ? [value] : []
    }

    // For non-multiple fields, extract first value from arrays
    return Array.isArray(value) ? this.getFirstNonEmpty(value) : value
  }

  /**
   * Get the first non-empty value from an array
   * Returns undefined if no non-empty value is found
   *
   * A value is considered "empty" if it is null, undefined, or a whitespace-only string
   */
  private getFirstNonEmpty(values: unknown[]): unknown {
    return values.find(value => {
      if (value === undefined || value === null) {
        return false
      }

      if (typeof value === 'string') {
        return value.trim() !== ''
      }

      return true
    })
  }
}
