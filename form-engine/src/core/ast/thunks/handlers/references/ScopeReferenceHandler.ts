import { NodeId } from '@form-engine/core/types/engine.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { getByPath } from '@form-engine/utils/utils'

/**
 * Handler for @scope namespace references
 *
 * Resolves ['@scope', levelIndex, ...nestedPath] by accessing the scope stack
 * at the specified level and navigating into the result.
 *
 * Level index: '0' = current scope, '1' = parent scope, '2' = grandparent, etc.
 */
export default class ScopeReferenceHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ReferenceASTNode,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const path = this.node.properties.path

    const level = typeof path[1] === 'string' ? parseInt(path[1] as string, 10) : (path[1] as number)

    if (typeof level !== 'number' || Number.isNaN(level)) {
      return { value: undefined }
    }

    // Calculate actual scope stack index (0 = most recent, 1 = parent, etc.)
    const scopeStackIndex = context.scope.length - 1 - level

    if (scopeStackIndex < 0 || scopeStackIndex >= context.scope.length) {
      return { value: undefined }
    }

    const baseValue = context.scope[scopeStackIndex]

    return { value: getByPath(baseValue, path.slice(2).join('.')) }
  }
}
