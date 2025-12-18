import { NodeId, ASTNode } from '@form-engine/core/types/engine.type'
import { CollectionASTNode } from '@form-engine/core/types/expressions.type'
import {
  AsyncThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  ThunkRuntimeHooks,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkTypeMismatchError from '@form-engine/errors/ThunkTypeMismatchError'
import { evaluateWithScope } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { structuralTraverse, StructuralVisitResult } from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isFieldBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Handler for Collection expressions
 *
 * Evaluates collection data source and instantiates template nodes for each item.
 * Runtime nodes are registered via hooks and wired with structural edges.
 *
 * Always asynchronous due to runtime node creation and hooks usage.
 */
export default class CollectionHandler implements AsyncThunkHandler {
  readonly isAsync = true as const

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
    const collectionSource = this.node.properties.collection

    let collectionData: unknown

    // Check if collection is a literal array or an AST node reference
    if (Array.isArray(collectionSource)) {
      collectionData = collectionSource
    } else {
      const collectionResult = await invoker.invoke(collectionSource.id, context)

      if (collectionResult.error) {
        return { error: collectionResult.error }
      }

      collectionData = collectionResult.value
    }

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

    // Phase 1: Create all nodes with their scopes
    const nodesToRegister: { node: any; itemScope: Record<string, unknown> }[] = []

    for (const { item, index: itemIndex } of validItems) {
      const itemScope: Record<string, unknown> =
        typeof item === 'object' && item !== null ? { ...item } : { '@value': item }
      itemScope['@index'] = itemIndex

      for (const templateJson of this.node.properties.template) {
        const runtimeNode = hooks.createNode(templateJson)
        nodesToRegister.push({ node: runtimeNode, itemScope })
      }
    }

    // Phase 2a: Resolve dynamic codes for each node (needs scope per item for @index)
    for (const { node, itemScope } of nodesToRegister) {
      const fieldsWithExprCodes = this.findFieldsWithExpressionCodes(node)

      if (fieldsWithExprCodes.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await evaluateWithScope(itemScope, context, async () => {
          const exprNodes = fieldsWithExprCodes.map(f => f.properties.code as ASTNode)
          await hooks.registerRuntimeNodesBatch(exprNodes, 'code')

          for (const field of fieldsWithExprCodes) {
            const codeNode = field.properties.code as ASTNode
            // eslint-disable-next-line no-await-in-loop
            const result = await invoker.invoke(codeNode.id, context)
            field.properties.code = String(result.value)
          }
        })
      }
    }

    // Phase 2b: Batch register all template nodes (codes are now resolved strings)
    const allNodes = nodesToRegister.map(({ node }) => node)
    await hooks.registerRuntimeNodesBatch(allNodes, 'template')

    // Phase 3: Evaluate each node with its proper scope
    for (const { node, itemScope } of nodesToRegister) {
      // eslint-disable-next-line no-await-in-loop
      await evaluateWithScope(itemScope, context, async () => {
        const result = await invoker.invoke(node.id, context)
        runtimeResults.push(result.value)
      })
    }

    // 6. Return evaluated results with custom metadata (dependencies tracked)
    return {
      value: runtimeResults,
      metadata: { dependencies: [this.node.properties.collection.id] },
    }
  }

  /**
   * Find all field blocks within a node tree that have expression codes (AST nodes)
   * rather than string codes. These need their codes resolved before registration.
   */
  private findFieldsWithExpressionCodes(node: ASTNode): ASTNode[] {
    const fields: ASTNode[] = []

    structuralTraverse(node, {
      enterNode(n) {
        if (isFieldBlockStructNode(n) && isASTNode(n.properties.code)) {
          fields.push(n)
        }

        return StructuralVisitResult.CONTINUE
      },
    })

    return fields
  }
}
