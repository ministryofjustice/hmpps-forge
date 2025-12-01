import { NodeId } from '@form-engine/core/types/engine.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluatePropertyValue } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for Step structure nodes
 *
 * Evaluates all properties in the step's properties object by:
 * 1. Recursively diving into nested structures (arrays, objects)
 * 2. Evaluating any AST nodes found within the properties
 * 3. Preserving primitives as-is
 *
 * This enables steps to contain dynamic expressions in any property,
 * including nested within arrays or objects (e.g., onLoad transitions,
 * blocks, conditional titles).
 */
export default class StepHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: StepASTNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    // Evaluate all properties in the step
    const evaluatedProperties = await evaluatePropertyValue(this.node.properties, context, invoker)

    // Return step representation with evaluated properties
    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        properties: evaluatedProperties,
      },
    }
  }
}
