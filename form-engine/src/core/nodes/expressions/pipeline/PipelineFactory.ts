import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import { PipelineASTNode } from '@form-engine/core/types/expressions.type'
import { PipelineExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'

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
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
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
