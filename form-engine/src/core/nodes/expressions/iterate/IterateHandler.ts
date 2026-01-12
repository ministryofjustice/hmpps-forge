import { NodeId, ASTNode } from '@form-engine/core/types/engine.type'
import { IterateASTNode } from '@form-engine/core/types/expressions.type'
import { IteratorType } from '@form-engine/form/types/enums'
import {
  AsyncThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  ThunkRuntimeHooks,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkTypeMismatchError from '@form-engine/errors/ThunkTypeMismatchError'
import { evaluateWithScope } from '@form-engine/core/ast/thunks/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { structuralTraverse, StructuralVisitResult } from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isFieldBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'

/**
 * Handler for Iterate expressions
 *
 * Evaluates input array and applies iterator operation per item:
 * - MAP: Transform each item using yield template
 * - FILTER: Keep items where predicate is true
 *
 * Uses the same scope management as CollectionHandler for Item() references.
 *
 * Always asynchronous due to runtime node creation and hooks usage.
 */
export default class IterateHandler implements AsyncThunkHandler {
  readonly isAsync = true as const

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: IterateASTNode,
  ) {}

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): Promise<HandlerResult> {
    // 1. Evaluate input to get array
    const inputResult = await this.evaluateInput(context, invoker)

    if ('error' in inputResult) {
      return { error: inputResult.error }
    }

    // 2. Normalize input to array (handles objects by converting to entries)
    const inputArray = this.normalizeToArray(inputResult.value)

    if (inputArray === undefined) {
      const error = ThunkTypeMismatchError.value(this.nodeId, 'array or object', typeof inputResult.value)
      return { error: error.toThunkError() }
    }

    // 3. Apply iterator based on type
    const iteratorType = this.node.properties.iterator.type

    // 4. If empty, return appropriate empty value
    if (inputArray.length === 0) {
      if (iteratorType === IteratorType.FIND) {
        return { value: undefined, metadata: { source: 'IterateHandler.find.empty' } }
      }

      return { value: [], metadata: { source: 'IterateHandler.empty' } }
    }

    if (iteratorType === IteratorType.FILTER) {
      return this.evaluateFilter(inputArray, context, invoker, hooks)
    }

    if (iteratorType === IteratorType.MAP) {
      return this.evaluateMap(inputArray, context, invoker, hooks)
    }

    if (iteratorType === IteratorType.FIND) {
      return this.evaluateFind(inputArray, context, invoker, hooks)
    }

    // Unknown iterator type
    const error = ThunkTypeMismatchError.value(this.nodeId, 'valid iterator type', iteratorType)
    return { error: error.toThunkError() }
  }

  /**
   * Evaluate the input expression to get the source array.
   */
  private async evaluateInput(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<{ value: unknown } | { error: any }> {
    const input = this.node.properties.input

    // Check if input is a literal array or an AST node reference
    if (Array.isArray(input)) {
      return { value: input }
    }

    if (isASTNode(input)) {
      const result = await invoker.invoke(input.id, context)

      if (result.error) {
        return { error: result.error }
      }

      return { value: result.value }
    }

    // Literal value (shouldn't happen but handle gracefully)
    return { value: input }
  }

  /**
   * Filter: Keep items where predicate evaluates to true.
   */
  private async evaluateFilter(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): Promise<HandlerResult> {
    const predicate = this.node.properties.iterator.predicate
    const results: unknown[] = []

    // Filter out null items and preserve indices
    const validItems = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)

    for (const { item, index } of validItems) {
      const itemScope = this.createItemScope(item, index)

      // eslint-disable-next-line no-await-in-loop
      const passesFilter = await evaluateWithScope(itemScope, context, async () => {
        // Transform and register the predicate for this item
        const predicateNode = hooks.transformValue(predicate)

        if (isASTNode(predicateNode)) {
          await hooks.registerRuntimeNodesBatch([predicateNode], 'predicate')
          const result = await invoker.invoke(predicateNode.id, context)

          return Boolean(result.value)
        }

        // If not an AST node, treat it as a literal boolean
        return Boolean(predicateNode)
      })

      if (passesFilter) {
        results.push(item)
      }
    }

    return {
      value: results,
      metadata: { source: 'IterateHandler.filter' },
    }
  }

  /**
   * Find: Return first item where predicate evaluates to true.
   */
  private async evaluateFind(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): Promise<HandlerResult> {
    const predicate = this.node.properties.iterator.predicate

    // Filter out null items and preserve indices
    const validItems = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)

    for (const { item, index } of validItems) {
      const itemScope = this.createItemScope(item, index)

      // eslint-disable-next-line no-await-in-loop
      const matchesPredicate = await evaluateWithScope(itemScope, context, async () => {
        const predicateNode = hooks.transformValue(predicate)

        if (isASTNode(predicateNode)) {
          await hooks.registerRuntimeNodesBatch([predicateNode], 'predicate')
          const result = await invoker.invoke(predicateNode.id, context)

          return Boolean(result.value)
        }

        return Boolean(predicateNode)
      })

      if (matchesPredicate) {
        return {
          value: item,
          metadata: { source: 'IterateHandler.find' },
        }
      }
    }

    // No match found
    return {
      value: undefined,
      metadata: { source: 'IterateHandler.find.notFound' },
    }
  }

  /**
   * Map: Transform each item using yield template.
   */
  private async evaluateMap(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): Promise<HandlerResult> {
    const yieldTemplate = this.node.properties.iterator.yield
    const results: unknown[] = []

    // Phase 1: Create nodes for all items (filter out nulls and preserve indices)
    const nodesToEvaluate = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)
      .map(({ item, index }) => ({
        node: hooks.transformValue(yieldTemplate),
        itemScope: this.createItemScope(item, index),
      }))

    // Phase 2a: Resolve dynamic codes for each node (needs scope per item for @index)
    // This must happen BEFORE batch registration so pseudo nodes are created correctly
    for (const { node, itemScope } of nodesToEvaluate) {
      if (isASTNode(node)) {
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
    }

    // Phase 2b: Batch register all nodes (codes are now resolved strings)
    const allNodes = nodesToEvaluate.map(({ node }) => node).filter(isASTNode)

    const nestedNodes = nodesToEvaluate.flatMap(({ node }) => (isASTNode(node) ? [] : this.findNestedASTNodes(node)))

    if (allNodes.length > 0) {
      await hooks.registerRuntimeNodesBatch(allNodes, 'yield')
    }

    if (nestedNodes.length > 0) {
      await hooks.registerRuntimeNodesBatch(nestedNodes, 'yield')
    }

    // Phase 3: Evaluate each with its scope
    for (const { node, itemScope } of nodesToEvaluate) {
      // eslint-disable-next-line no-await-in-loop
      await evaluateWithScope(itemScope, context, async () => {
        if (isASTNode(node)) {
          const result = await invoker.invoke(node.id, context)
          results.push(result.value)
        } else {
          const evaluated = await this.evaluateNestedNodes(node, invoker, context)
          results.push(evaluated)
        }
      })
    }

    return {
      value: results,
      metadata: { source: 'IterateHandler.map' },
    }
  }

  /**
   * Normalize input to an array for iteration.
   *
   * - Arrays are returned as-is
   * - Objects are converted to entries with @key property
   * - Other types return undefined (not iterable)
   *
   * @example
   * // Array input
   * [{ name: 'Alice' }] → [{ name: 'Alice' }]
   *
   * // Object input with object values
   * { accommodation: { score: 5 } } → [{ '@key': 'accommodation', score: 5 }]
   *
   * // Object input with primitive values
   * { accommodation: 5 } → [{ '@key': 'accommodation', '@value': 5 }]
   */
  private normalizeToArray(input: unknown): unknown[] | undefined {
    if (Array.isArray(input)) {
      return input
    }

    if (typeof input === 'object' && input !== null) {
      return Object.entries(input).map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return { '@key': key, ...value }
        }

        return { '@key': key, '@value': value }
      })
    }

    return undefined
  }

  /**
   * Create scope bindings for an item.
   * Spreads object properties, adds @index, and tags as iterator scope.
   *
   * The @type: 'iterator' tag allows ScopeReferenceHandler to distinguish
   * iterator scopes from other scope types (e.g., predicate scopes) when
   * resolving Item() references.
   * Spreads object properties and adds @index and @item.
   *
   * @item stores the original value for Item() / Item().value() access
   * @index stores the iteration index for Item().index() access
   * Object properties are spread for Item().path('prop') access
   */
  private createItemScope(item: unknown, index: number): Record<string, unknown> {
    const scope: Record<string, unknown> = typeof item === 'object' && item !== null ? { ...item } : { '@value': item }

    scope['@index'] = index
    scope['@type'] = 'iterator'
    scope['@item'] = item

    return scope
  }

  /**
   * Recursively find all AST nodes nested within a plain object or array.
   * Used to collect nodes that need to be registered before evaluation.
   */
  private findNestedASTNodes(value: unknown): ASTNode[] {
    const nodes: ASTNode[] = []

    if (value === null || value === undefined) {
      return nodes
    }

    if (isASTNode(value)) {
      nodes.push(value)
      return nodes
    }

    if (Array.isArray(value)) {
      value.forEach(item => {
        nodes.push(...this.findNestedASTNodes(item))
      })
      return nodes
    }

    if (typeof value === 'object') {
      Object.values(value).forEach(val => {
        nodes.push(...this.findNestedASTNodes(val))
      })
    }

    return nodes
  }

  /**
   * Recursively evaluate a plain object by invoking any nested AST nodes
   * and substituting their values.
   */
  private async evaluateNestedNodes(
    value: unknown,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<unknown> {
    if (value === null || value === undefined) {
      return value
    }

    if (isASTNode(value)) {
      const result = await invoker.invoke(value.id, context)
      return result.value
    }

    if (Array.isArray(value)) {
      return Promise.all(value.map(item => this.evaluateNestedNodes(item, invoker, context)))
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {}

      await Promise.all(
        Object.entries(value).map(async ([key, val]) => {
          result[key] = await this.evaluateNestedNodes(val, invoker, context)
        }),
      )

      return result
    }

    return value
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
