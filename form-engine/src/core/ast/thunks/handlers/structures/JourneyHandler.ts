import { NodeId } from '@form-engine/core/types/engine.type'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
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
 * Handler for Journey structure nodes
 *
 * Evaluates properties in the journey based on whether it's an ancestor:
 *
 * For ANCESTOR journeys (isAncestorOfStep = true):
 * - All properties except transitions (handled by FormStepController)
 *
 * For OTHER journeys:
 * - Only structural properties: code, path, children, steps, metadata etc.
 * - Rendering properties are skipped
 *
 * This runtime filtering replaces compile-time filtering in findRelevantNodes,
 * allowing thunks to be compiled once and shared across all step artefacts.
 *
 * Synchronous when all nested AST nodes in properties are sync.
 * Asynchronous when any nested AST node is async.
 */
export default class JourneyHandler implements HybridThunkHandler {
  isAsync = true

  // Transition properties are handled separately by FormStepController
  private static readonly TRANSITION_PROPS = ['onLoad', 'onAccess']

  // Properties needed for structural navigation on non-ancestor journeys
  private static readonly STRUCTURAL_PROPS = [
    'code',
    'version',
    'path',
    'title',
    'description',
    'children',
    'steps',
    'metadata',
  ]

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: JourneyASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const isAncestorOfStep = deps.metadataRegistry.get(this.nodeId, 'isAncestorOfStep', false)

    // Determine which properties to check based on journey context
    const propertiesToCheck = isAncestorOfStep
      ? Object.fromEntries(
          Object.entries(this.node.properties).filter(([key]) => !JourneyHandler.TRANSITION_PROPS.includes(key)),
        )
      : Object.fromEntries(
          Object.entries(this.node.properties).filter(([key]) => JourneyHandler.STRUCTURAL_PROPS.includes(key)),
        )

    this.isAsync = this.containsAsyncNodes(propertiesToCheck, deps)
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
    const propertiesToEvaluate = this.getPropertiesToEvaluate(context)
    const evaluatedProperties = this.evaluatePropertyValueSync(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        properties: evaluatedProperties,
      },
    }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const propertiesToEvaluate = this.getPropertiesToEvaluate(context)
    const evaluatedProperties = await evaluatePropertyValue(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        properties: evaluatedProperties,
      },
    }
  }

  /**
   * Determine which properties to evaluate based on journey context
   *
   * Ancestor journeys: all properties except transitions
   * Other journeys: only structural properties
   */
  private getPropertiesToEvaluate(context: ThunkEvaluationContext): Record<string, unknown> {
    const isAncestorOfStep = context.metadataRegistry.get(this.nodeId, 'isAncestorOfStep', false)

    if (isAncestorOfStep) {
      // Ancestor journey: all non-transition properties
      return Object.fromEntries(
        Object.entries(this.node.properties).filter(([key]) => !JourneyHandler.TRANSITION_PROPS.includes(key)),
      )
    }

    // Other journeys: only structural properties
    return Object.fromEntries(
      Object.entries(this.node.properties).filter(([key]) => JourneyHandler.STRUCTURAL_PROPS.includes(key)),
    )
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
