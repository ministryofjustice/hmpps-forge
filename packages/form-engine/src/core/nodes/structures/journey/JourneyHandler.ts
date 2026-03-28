import { NodeId } from '@form-engine/core/types/engine.type'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { evaluatePropertyValue } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluatePropertyValueSync } from '@form-engine/core/utils/thunkEvaluatorsSync'

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
export default class JourneyHandler implements ThunkHandler {
  isAsync = false

  private propertiesWithNodes: ReadonlySet<string> | undefined

  // Transition properties are handled separately by FormStepController
  private static readonly TRANSITION_PROPS = ['onLoad', 'onAccess']

  private static readonly TRANSITION_PROPS_SET = new Set(JourneyHandler.TRANSITION_PROPS)

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

  private static readonly STRUCTURAL_PROPS_SET = new Set(JourneyHandler.STRUCTURAL_PROPS)

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: JourneyASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const isAncestorOfStep = deps.metadataRegistry.get(this.nodeId, 'isAncestorOfStep', false)
    const propertiesWithNodes = new Set<string>()
    let hasAsync = false

    deps.astNodeTree.getChildren(this.nodeId).forEach(childId => {
      const property = deps.metadataRegistry.get<string>(childId, 'attachedToParentProperty')

      if (!property) {
        return
      }

      propertiesWithNodes.add(property)

      if (hasAsync) {
        return
      }

      const isRelevant = isAncestorOfStep
        ? !JourneyHandler.TRANSITION_PROPS_SET.has(property)
        : JourneyHandler.STRUCTURAL_PROPS_SET.has(property)

      if (!isRelevant) {
        return
      }

      const handler = deps.thunkHandlerRegistry.get(childId)

      if (handler?.isAsync ?? true) {
        hasAsync = true
      }
    })

    this.isAsync = hasAsync
    this.propertiesWithNodes = propertiesWithNodes
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const propertiesToEvaluate = this.getPropertiesToEvaluate(context)
    const evaluatedProperties = this.evaluatePropertiesSync(propertiesToEvaluate, context, invoker)

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
    const evaluatedProperties = await this.evaluateProperties(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        properties: evaluatedProperties,
      },
    }
  }

  private evaluatePropertiesSync(
    properties: Record<string, unknown>,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    Object.entries(properties).forEach(([key, value]) => {
      if (this.propertiesWithNodes && !this.propertiesWithNodes.has(key)) {
        result[key] = value
        return
      }

      result[key] = evaluatePropertyValueSync(value, context, invoker)
    })

    return result
  }

  private async evaluateProperties(
    properties: Record<string, unknown>,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}

    await Promise.all(
      Object.entries(properties).map(async ([key, value]) => {
        if (this.propertiesWithNodes && !this.propertiesWithNodes.has(key)) {
          result[key] = value
          return
        }

        result[key] = await evaluatePropertyValue(value, context, invoker)
      }),
    )

    return result
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
}
