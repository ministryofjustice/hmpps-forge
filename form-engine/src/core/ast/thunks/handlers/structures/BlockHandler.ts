import { NodeId } from '@form-engine/core/types/engine.type'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluatePropertyValue } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for Block structure nodes (both field and basic blocks)
 *
 * Evaluates all properties in the block's properties object by:
 * 1. Recursively diving into nested structures (arrays, objects)
 * 2. Evaluating any AST nodes found within the properties
 * 3. Preserving primitives as-is
 *
 * This enables blocks to contain dynamic expressions in any property,
 * including nested within arrays or objects (e.g., validation rules,
 * conditional visibility, default values).
 */
export default class BlockHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: BlockASTNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    // Evaluate all properties in the block with special handling for dependent/validate
    const evaluatedProperties = await this.evaluateBlockProperties(this.node.properties, context, invoker)

    // Return block representation with evaluated properties
    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        variant: this.node.variant,
        blockType: this.node.blockType,
        properties: evaluatedProperties,
      },
    }
  }

  /**
   * Evaluate block properties with special handling for dependent/validate relationship
   *
   * If a block has a 'dependent' property that evaluates to false, the 'validate'
   * property will not be evaluated (returns empty array instead).
   */
  private async evaluateBlockProperties(
    properties: Record<string, unknown>,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<Record<string, unknown>> {
    // First, check if there's a dependent property
    const hasDependentProperty = 'dependent' in properties
    let isDependentActive = true

    if (hasDependentProperty) {
      const dependentValue = await evaluatePropertyValue(properties.dependent, context, invoker)
      isDependentActive = Boolean(dependentValue)
    }

    // Evaluate all properties
    const result: Record<string, unknown> = {}

    await Promise.all(
      Object.entries(properties).map(async ([key, value]) => {
        // Skip validation evaluation if dependent is false
        if (key === 'validate' && !isDependentActive) {
          result[key] = []
          return
        }

        result[key] = await evaluatePropertyValue(value, context, invoker)
      }),
    )

    return result
  }
}
