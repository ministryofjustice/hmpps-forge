import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType } from '../../../../../../authoring/types/enums'
import { ReferenceASTNode } from '../../../../../contracts/ast/expressions.type'
import type { ASTNode } from '../../../../../contracts/ast/engine.type'
import { ReferenceExpr } from '../../../../../../authoring/types/expressions.type'
import { isExpression } from '../../../../../../authoring/typeguards/expressions'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'

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
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  /**
   * Transform Reference expression: Points to data in context
   */
  create(json: ReferenceExpr): ReferenceASTNode {
    // Transform base expression if present
    const base = json.base ? this.nodeFactory.transformChild<ASTNode>(json.base, 'base') : undefined

    // Build path - allow empty path when base is present
    const referencePath = this.buildReferencePath(json.path, !!base)

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.REFERENCE,
      properties: { path: referencePath, base },
    }
  }

  /**
   * Build the reference path, transforming any dynamic expressions.
   * Path splitting is done at the builder level - factory just passes through.
   *
   * @param path - The path segments
   * @param allowEmpty - Whether to allow empty path (valid when base is present)
   */
  private buildReferencePath(path: readonly unknown[], allowEmpty = false): ReferenceASTNode['properties']['path'] {
    if (!Array.isArray(path) || (!allowEmpty && path.length === 0)) {
      throw new InvalidNodeError({
        message: 'Reference path must be a non-empty array',
        actual: JSON.stringify(path),
        code: 'INVALID_REFERENCE_PATH',
      })
    }

    // Transform any expressions in the path (e.g., dynamic keys)
    return path.map((segment, index) =>
      isExpression(segment)
        ? this.nodeFactory.transformChild(segment, 'path', index)
        : this.assertReferenceSegment(segment),
    )
  }

  private assertReferenceSegment(segment: unknown): string | number {
    if (typeof segment === 'string' || typeof segment === 'number') {
      return segment
    }

    throw new InvalidNodeError({
      message: 'Reference path segments must be strings, numbers, or expressions',
      actual: JSON.stringify(segment),
      code: 'INVALID_REFERENCE_PATH_SEGMENT',
    })
  }
}
