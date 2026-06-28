import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType } from '../../../../../../authoring/types/enums'
import { PipelineASTNode } from '../../../../../contracts/ast/expressions.type'
import type { ASTNode } from '../../../../../contracts/ast/engine.type'
import { PipelineExpr } from '../../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
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
  ) {}

  /**
   * Transform Pipeline expression: Sequential data transformations
   */
  create(json: PipelineExpr): PipelineASTNode {
    // Initial value to transform - use transformValue to support both AST nodes and literals
    const input = this.nodeFactory.transformChild(json.input, 'input')

    // Transform each pipeline step
    const steps = json.steps.map((arg: unknown, index) => this.nodeFactory.transformChild<ASTNode>(arg, 'steps', index))

    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.PIPELINE,
      properties: {
        input,
        steps,
      },
    }
  }
}
