import { NodeId } from '@form-engine/core/types/engine.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluatePropertyValue } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

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
 *
 * Synchronous when all nested AST nodes in properties are sync.
 * Asynchronous when any nested AST node is async.
 */
export default class StepHandler implements HybridThunkHandler {
  isAsync = true

  // Transition properties are handled separately by FormStepController,
  // not during the main AST evaluation
  private static readonly TRANSITION_PROPS = ['onLoad', 'onAccess', 'onAction', 'onSubmission']

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: StepASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const propertiesToCheck = Object.entries(this.node.properties).filter(
      ([key]) => !StepHandler.TRANSITION_PROPS.includes(key),
    )

    const asyncProperties: string[] = []

    propertiesToCheck.forEach(([key, value]) => {
      if (this.containsAsyncNodes(value, deps)) {
        asyncProperties.push(key)
      }
    })

    this.isAsync = asyncProperties.length > 0
  }

  private containsAsyncNodes(value: unknown, deps: MetadataComputationDependencies): boolean {
    if (value === null || value === undefined) {
      return false
    }

    if (isASTNode(value)) {
      const handler = deps.thunkHandlerRegistry.get(value.id)

      return handler?.isAsync ?? true
    }

    if (Array.isArray(value)) {
      return value.some(item => this.containsAsyncNodes(item, deps))
    }

    if (typeof value === 'object') {
      return Object.values(value).some(prop => this.containsAsyncNodes(prop, deps))
    }

    return false
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    // Filter out transition properties - they're handled separately by FormStepController
    const propertiesToEvaluate = Object.fromEntries(
      Object.entries(this.node.properties).filter(([key]) => !StepHandler.TRANSITION_PROPS.includes(key)),
    )

    // Evaluate non-transition properties
    const evaluatedProperties = this.evaluatePropertyValueSync(propertiesToEvaluate, context, invoker)

    // Return step representation with evaluated properties
    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        properties: evaluatedProperties,
      },
    }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    // Filter out transition properties - they're handled separately by FormStepController
    const propertiesToEvaluate = Object.fromEntries(
      Object.entries(this.node.properties).filter(([key]) => !StepHandler.TRANSITION_PROPS.includes(key)),
    )

    // Evaluate non-transition properties
    const evaluatedProperties = await evaluatePropertyValue(propertiesToEvaluate, context, invoker)

    // Return step representation with evaluated properties
    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        properties: evaluatedProperties,
      },
    }
  }

  private evaluatePropertyValueSync(
    value: unknown,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (isASTNode(value)) {
      if (!context.nodeRegistry.has(value.id)) {
        return undefined
      }

      const result = invoker.invokeSync(value.id, context)

      return result.error ? undefined : result.value
    }

    if (Array.isArray(value)) {
      return value.map(item => this.evaluatePropertyValueSync(item, context, invoker)).filter(v => v !== undefined)
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {}

      Object.entries(value).forEach(([key, val]) => {
        result[key] = this.evaluatePropertyValueSync(val, context, invoker)
      })

      return result
    }

    return value
  }
}
