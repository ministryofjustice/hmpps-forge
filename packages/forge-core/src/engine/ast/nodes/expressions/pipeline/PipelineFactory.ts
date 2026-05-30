import { ASTNodeType } from '../../../../contracts/ast/enums'
import { ExpressionType } from '../../../../../authoring/types/enums'
import { PipelineASTNode } from '../../../../contracts/ast/expressions.type'
import { PipelineExpr } from '../../../../../authoring/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'

/**
 * PipelineFactory: Creates Pipeline expression AST nodes
 *
 * Pipeline expressions implement sequential data transformations.
 * Input flows through each step: input -> step1 -> step2 -> output
 */
export default class PipelineFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  /**
   * Transform Pipeline expression: Sequential data transformations
   */
  create(json: PipelineExpr): PipelineASTNode {
    // Initial value to transform - use transformValue to support both AST nodes and literals
    const input = this.nodeFactory.transformValue(json.input)

    // Transform each pipeline step
    const steps = json.steps.map((arg: any) => this.nodeFactory.transformValue(arg))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.PIPELINE,
      properties: {
        input,
        steps,
      },
      raw: json,
    }
  }
}
