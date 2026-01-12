import { NodeId } from '@form-engine/core/types/engine.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { getByPath } from '@form-engine/utils/utils'

/**
 * Handler for @scope namespace references
 *
 * Resolves ['@scope', levelIndex, ...nestedPath] by accessing the scope stack
 * at the specified level and navigating into the result.
 *
 * Level index: '0' = current scope, '1' = parent scope, '2' = grandparent, etc.
 *
 * Always synchronous - scope access is a pure property lookup.
 */
export default class ScopeReferenceHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ReferenceASTNode,
  ) {}

  computeIsAsync(_deps: MetadataComputationDependencies): void {
    // Scope references are always sync - pure property lookup
    this.isAsync = false
  }

  evaluateSync(context: ThunkEvaluationContext, _invoker: ThunkInvocationAdapter): HandlerResult {
    const path = this.node.properties.path

    const level = typeof path[1] === 'string' ? parseInt(path[1] as string, 10) : (path[1] as number)

    if (typeof level !== 'number' || Number.isNaN(level)) {
      return { value: undefined }
    }

    // Find the scope frame at the requested level, counting only iterator-type frames.
    // This ensures Item() references work correctly even when predicate scopes
    // (pushed by TestPredicateHandler for @value) are on the stack.
    const baseValue = this.findIteratorScopeAtLevel(context.scope, level)

    if (baseValue === undefined) {
      return { value: undefined }
    }

    const remainingPath = path.slice(2).join('.')

    // When no further path (Item() or Item().value()), return the original item
    if (remainingPath === '') {
      return { value: baseValue['@item'] }
    }

    return { value: getByPath(baseValue, remainingPath) }
  }

  /**
   * Find the iterator scope frame at the specified level.
   * Level 0 = most recent iterator scope, level 1 = parent iterator scope, etc.
   * Skips non-iterator scope frames (e.g., predicate scopes with @type !== 'iterator').
   */
  private findIteratorScopeAtLevel(
    scope: Record<string, unknown>[],
    level: number,
  ): Record<string, unknown> | undefined {
    let iteratorCount = 0

    for (let i = scope.length - 1; i >= 0; i--) {
      const frame = scope[i]

      // Only count frames tagged as 'iterator' (or untagged for backwards compatibility)
      if (frame['@type'] === 'iterator' || frame['@type'] === undefined) {
        if (iteratorCount === level) {
          return frame
        }

        iteratorCount++
      }
    }

    return undefined
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    // Delegate to sync implementation
    return this.evaluateSync(context, invoker)
  }
}
