import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { FunctionASTNode } from '../../../../../contracts/ast/expressions.type'
import { FunctionExpr, ResolvableValue } from '../../../../../../authoring/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'

/**
 * FunctionFactory: Creates Function expression AST nodes
 *
 * Function expressions are registered function calls.
 * Types: Condition (boolean), Transformer (value), Effect (side-effect), Generator (value)
 */
export default class FunctionFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  /**
   * Transform Function expression: Registered function calls
   */
  create(json: FunctionExpr<ResolvableValue[]>): FunctionASTNode {
    const funcType = json.type

    // Transform arguments recursively
    const args = json.arguments.map((arg: unknown, index) => this.nodeFactory.transformChild(arg, 'arguments', index))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: funcType,
      properties: {
        name: json.name,
        arguments: args,
      },
    }
  }
}
