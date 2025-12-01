import { NodeId } from '@form-engine/core/types/engine.type'
import { AnswerLocalPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { isASTNode, isPseudoNode } from '@form-engine/core/typeguards/nodes'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { isSafePropertyKey } from '@form-engine/core/ast/utils/propertyAccess'
import { evaluateUntilFirstMatch } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'
import ThunkLookupError from '@form-engine/errors/ThunkLookupError'

/**
 * Handler for ANSWER_LOCAL pseudo nodes
 *
 * Implements waterfall resolution strategy for fields on the current step:
 * 1. Try formatPipeline (POST → formatters) if exists
 * 2. Fall back to raw POST data if no formatPipeline
 * 3. Fall back to defaultValue if no POST data
 * 4. Store result in context.global.answers (mutable cache)
 *
 * This handler is more complex than others because it orchestrates multiple
 * potential data sources and delegates to other handlers via the invoker.
 */
export default class AnswerLocalHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: AnswerLocalPseudoNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult<unknown>> {
    const { baseFieldCode, fieldNodeId } = this.pseudoNode.properties

    if (!isSafePropertyKey(baseFieldCode)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, baseFieldCode, PseudoNodeType.ANSWER_LOCAL)
      return { error: error.toThunkError() }
    }

    const fieldNode = context.nodeRegistry.get(fieldNodeId) as FieldBlockASTNode

    if (!fieldNode) {
      const error = ThunkLookupError.node(fieldNodeId, this.nodeId)
      return { error: error.toThunkError() }
    }

    // Build priority-ordered sources: formatPipeline → POST → defaultValue (AST)
    const sourceNodeIds = this.buildSourceNodeIds(fieldNode, context, baseFieldCode)

    // Try each source in order, return first non-undefined value
    const value = await evaluateUntilFirstMatch(sourceNodeIds, context, invoker)

    // Try just get the value from the answers context
    if (value !== undefined) {
      context.global.answers[baseFieldCode] = value
      return { value }
    }

    // Try literal defaultValue (non-AST)
    const defaultValue = fieldNode.properties.defaultValue

    if (defaultValue !== undefined && !isASTNode(defaultValue)) {
      context.global.answers[baseFieldCode] = defaultValue
      return { value: defaultValue }
    }

    // No value found
    context.global.answers[baseFieldCode] = undefined
    return { value: undefined }
  }

  /**
   * Build priority-ordered array of source NodeIds to try
   * Order: formatPipeline → POST → defaultValue (if AST node)
   */
  private buildSourceNodeIds(
    fieldNode: FieldBlockASTNode,
    context: ThunkEvaluationContext,
    baseFieldCode: string,
  ): NodeId[] {
    const sourceNodeIds: NodeId[] = []

    const formatPipeline = fieldNode.properties.formatPipeline
    if (formatPipeline && isASTNode(formatPipeline)) {
      sourceNodeIds.push(formatPipeline.id)
    }

    const postPseudoNode = this.findPostPseudoNode(context, baseFieldCode)
    if (postPseudoNode) {
      sourceNodeIds.push(postPseudoNode.id)
    }

    const defaultValue = fieldNode.properties.defaultValue
    if (defaultValue && isASTNode(defaultValue)) {
      sourceNodeIds.push(defaultValue.id)
    }

    return sourceNodeIds
  }

  /**
   * Find POST pseudo node for the given field code
   * Searches through the node registry for a POST pseudo node with matching baseFieldCode
   */
  private findPostPseudoNode(context: ThunkEvaluationContext, baseFieldCode: string) {
    // Search through all nodes in the registry for POST pseudo node
    const allEntries = context.nodeRegistry.getAll()

    return Array.from(allEntries.values()).find(
      node =>
        isPseudoNode(node) && node.type === PseudoNodeType.POST && node.properties.baseFieldCode === baseFieldCode,
    )
  }
}
