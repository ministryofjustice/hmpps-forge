import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionASTNode, PipelineASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isPipelineExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * PipelineExpressionWiring: Wires pipeline expressions to their inputs and steps
 *
 * Creates dependency edges for pipeline transformation nodes:
 * - Pipelines have an input expression and an array of transformation steps
 * - Input and all steps must be evaluated before the pipeline result is known
 *
 * Wiring pattern for PIPELINE:
 * - INPUT → PIPELINE (input must be evaluated first)
 * - STEP[i] → PIPELINE (each step must be evaluated)
 */
export default class PipelineExpressionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all pipeline expressions to their input and transformer nodes
   */
  wire() {
    const expressionNodes = this.wiringContext.findNodesByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isPipelineExprNode)
      .forEach(pipelineNode => {
        this.wirePipeline(pipelineNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isPipelineExprNode)
      .forEach(pipelineNode => {
        this.wirePipeline(pipelineNode)
      })
  }

  /**
   * Wire a pipeline expression to its input and step dependencies
   *
   * Creates edges: input → pipeline, step[i] → pipeline
   */
  private wirePipeline(pipelineNode: PipelineASTNode) {
    const input = pipelineNode.properties.input
    const steps = pipelineNode.properties.steps

    // Wire input → pipeline (input must be evaluated before pipeline)
    if (isASTNode(input)) {
      this.wiringContext.graph.addEdge(input.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'input',
      })
    }

    // Wire steps → pipeline
    if (Array.isArray(steps)) {
      steps.forEach((step, index) => {
        if (isASTNode(step)) {
          this.wiringContext.graph.addEdge(step.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
            property: 'steps',
            index,
          })
        }
      })
    }

  }
}
