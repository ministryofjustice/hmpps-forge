import { NodeId } from '@form-engine/core/types/engine.type'
import { CollectionASTNode } from '@form-engine/core/types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  ThunkRuntimeHooks,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkTypeMismatchError from '@form-engine/errors/ThunkTypeMismatchError'
import { evaluateWithScope } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for Collection expressions
 *
 * Evaluates collection data source and instantiates template nodes for each item.
 * Runtime nodes are registered via hooks and wired with structural edges.
 */
export default class CollectionHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: CollectionASTNode,
  ) {}

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): Promise<HandlerResult> {
    // 1. Evaluate collection source to get array of items
    const collectionResult = await invoker.invoke(this.node.properties.collection.id, context)

    if (collectionResult.error) {
      return { error: collectionResult.error }
    }

    const collectionData = collectionResult.value

    // 2. Validate it's an array
    if (!Array.isArray(collectionData)) {
      const error = ThunkTypeMismatchError.value(this.nodeId, 'array', typeof collectionData)

      return { error: error.toThunkError() }
    }

    // 3. If empty, evaluate fallback (if provided)
    if (collectionData.length === 0) {
      if (this.node.properties.fallback) {
        const fallbackResults = await Promise.all(
          this.node.properties.fallback.map(fallbackNode => invoker.invoke(fallbackNode.id, context)),
        )

        return {
          value: fallbackResults.map(r => r.value),
          metadata: { source: 'CollectionHandler.fallback' },
        }
      }

      return {
        value: [],
        metadata: { source: 'CollectionHandler.empty' },
      }
    }

    // 4. For each item, instantiate and evaluate template with scoped context
    const runtimeResults: unknown[] = []

    // Filter non-null items with their indices
    const validItems = collectionData.map((item, index) => ({ item, index })).filter(({ item }) => item != null)

    // Process each valid item sequentially
    for (const { item, index: itemIndex } of validItems) {
      // Build scope bindings for template evaluation
      // Store item properties directly in scope for easy access via @scope.property
      const itemScope: Record<string, unknown> =
        typeof item === 'object' && item !== null ? { ...item } : { '@value': item }
      itemScope['@index'] = itemIndex

      // eslint-disable-next-line no-await-in-loop
      await evaluateWithScope(itemScope, context, async () => {
        // Instantiate and evaluate each template element for this item
        for (const templateJson of this.node.properties.template) {
          const runtimeNode = hooks.createNode(templateJson)

          // Register runtime subtree (root + children). This may compile handlers when a runtime builder is present.
          hooks.registerRuntimeNode(runtimeNode, 'template')

          // Evaluate the runtime node with the scoped context
          // eslint-disable-next-line no-await-in-loop
          const result = await invoker.invoke(runtimeNode.id, context)

          runtimeResults.push(result.value)
        }
      })
    }

    // 6. Return evaluated results with custom metadata (dependencies tracked)
    return {
      value: runtimeResults,
      metadata: { dependencies: [this.node.properties.collection.id] },
    }
  }
}
