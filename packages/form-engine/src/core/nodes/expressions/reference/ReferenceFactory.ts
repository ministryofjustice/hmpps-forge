import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { ReferenceExpr } from '@form-engine/form/types/expressions.type'
import { isExpression } from '@form-engine/form/typeguards/expressions'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'

/**
 * ReferenceFactory: Creates Reference expression AST nodes
 *
 * Reference expressions point to data in context.
 * Examples: Answer('field'), Data('external.value'), Self(), Item()
 *
 * When `base` is present, the reference evaluates the base expression first
 * and then navigates into the result using the path. Empty path is valid
 * when base is present (returns base result directly).
 */
export default class ReferenceFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Reference expression: Points to data in context
   */
  create(json: ReferenceExpr): ReferenceASTNode {
    // Transform base expression if present
    const base = json.base ? this.nodeFactory.transformValue(json.base) : undefined

    // Build path - allow empty path when base is present
    const path = this.buildReferencePath(json.path, !!base)

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.REFERENCE,
      properties: { path, base },
      raw: json,
    }
  }

  /**
   * Build the reference path, transforming any dynamic expressions.
   * Path splitting is done at the builder level - factory just passes through.
   *
   * @param path - The path segments
   * @param allowEmpty - Whether to allow empty path (valid when base is present)
   */
  private buildReferencePath(path: any[], allowEmpty = false): any[] {
    if (!Array.isArray(path) || (!allowEmpty && path.length === 0)) {
      throw new InvalidNodeError({
        message: 'Reference path must be a non-empty array',
        actual: JSON.stringify(path),
        code: 'INVALID_REFERENCE_PATH',
      })
    }

    // Transform any expressions in the path (e.g., dynamic keys)
    return path.map(segment => (isExpression(segment) ? this.nodeFactory.transformValue(segment) : segment))
  }
}
