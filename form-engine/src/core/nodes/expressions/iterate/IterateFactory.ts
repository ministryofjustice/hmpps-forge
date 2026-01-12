import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, IteratorType } from '@form-engine/form/types/enums'
import { IterateASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { IterateExpr } from '@form-engine/form/types/expressions.type'
import {
  isMapIteratorConfig,
  isFilterIteratorConfig,
  isFindIteratorConfig,
} from '@form-engine/form/typeguards/expressions'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'

/**
 * IterateFactory: Creates Iterate expression AST nodes
 *
 * Iterate expressions implement per-item iteration over collections.
 *
 * IMPORTANT: Like Collection, the yield/predicate templates are stored as raw JSON,
 * NOT pre-compiled AST nodes. At runtime, they are instantiated once per collection item,
 * creating fresh AST nodes with unique runtime IDs. This allows Item() references to be
 * substituted with actual item data before node creation.
 */
export default class IterateFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Iterate expression: Per-item iteration over collections
   */
  create(json: IterateExpr): IterateASTNode {
    const properties: {
      input: ASTNode | any
      iterator: {
        type: IteratorType
        yield?: any
        predicate?: any
      }
    } = {
      // Transform the input data source (this IS an expression that needs evaluation)
      input: this.nodeFactory.transformValue(json.input),
      iterator: {
        type: json.iterator.type,
      },
    }

    // For MAP: store yield template as raw JSON (instantiated at runtime per item)
    if (isMapIteratorConfig(json.iterator)) {
      properties.iterator.yield = json.iterator.yield
    }

    // For FILTER: store predicate as raw JSON (instantiated at runtime per item)
    if (isFilterIteratorConfig(json.iterator)) {
      properties.iterator.predicate = json.iterator.predicate
    }

    // For FIND: store predicate as raw JSON (instantiated at runtime per item)
    if (isFindIteratorConfig(json.iterator)) {
      properties.iterator.predicate = json.iterator.predicate
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.ITERATE,
      properties,
      raw: json,
    }
  }
}
