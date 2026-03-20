import { NodeId, ASTNode } from '@form-engine/core/types/engine.type'
import { IterateASTNode } from '@form-engine/core/types/expressions.type'
import { IteratorType } from '@form-engine/form/types/enums'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  ThunkRuntimeHooks,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import ThunkTypeMismatchError from '@form-engine/errors/ThunkTypeMismatchError'
import { evaluateWithScope } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluateWithScopeSync } from '@form-engine/core/utils/thunkEvaluatorsSync'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isFieldBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import TemplateAsyncAnalyzer from '@form-engine/core/compilation/analyzers/TemplateAsyncAnalyzer'
import ValidationTemplateAnalyzer from '@form-engine/core/compilation/analyzers/ValidationTemplateAnalyzer'

/**
 * Handler for Iterate expressions
 *
 * Evaluates input array and applies iterator operation per item:
 * - MAP: Transform each item using yield template
 * - FILTER: Keep items where predicate is true
 * - FIND: Return first item where predicate is true
 *
 * Uses scope management to enable Item() references within predicates and yields.
 *
 * Sync-capable when input node and template contents are both sync.
 * Template async status is determined at compile time via TemplateAsyncAnalyzer
 * and stored in metadata for use by ThunkRuntimeHooksFactory.
 */
export default class IterateHandler implements ThunkHandler {
  isAsync = false

  private isTemplateAsync = false

  private templateYieldsFields = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: IterateASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const input = this.node.properties.input
    const iterator = this.node.properties.iterator

    let inputIsAsync = false

    if (isASTNode(input)) {
      const handler = deps.thunkHandlerRegistry.get(input.id)
      inputIsAsync = handler?.isAsync ?? true
    }

    this.isTemplateAsync =
      TemplateAsyncAnalyzer.containsAsyncNodes(iterator.yieldTemplate, deps.functionRegistry) ||
      TemplateAsyncAnalyzer.containsAsyncNodes(iterator.predicateTemplate, deps.functionRegistry)

    this.isAsync = inputIsAsync || this.isTemplateAsync
    this.templateYieldsFields = ValidationTemplateAnalyzer.mayYieldFields(iterator.yieldTemplate)
    deps.metadataRegistry.set(this.nodeId, 'isTemplateAsync', this.isTemplateAsync)
  }

  evaluateSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks?: ThunkRuntimeHooks,
  ): HandlerResult {
    if (!hooks) {
      throw new Error(`IterateHandler.evaluateSync() requires hooks (nodeId: ${this.nodeId})`)
    }

    // 1. Evaluate input to get array
    const inputResult = this.evaluateInputSync(context, invoker)

    if ('error' in inputResult) {
      return { error: inputResult.error }
    }

    // 2. Normalize input to array
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
      return this.evaluateFilterSync(inputArray, context, invoker, hooks)
    }

    if (iteratorType === IteratorType.MAP) {
      return this.evaluateMapSync(inputArray, context, invoker, hooks)
    }

    if (iteratorType === IteratorType.FIND) {
      return this.evaluateFindSync(inputArray, context, invoker, hooks)
    }

    const error = ThunkTypeMismatchError.value(this.nodeId, 'valid iterator type', iteratorType)
    return { error: error.toThunkError() }
  }

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
   * Evaluate the input expression synchronously.
   */
  private evaluateInputSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): { value: unknown } | { error: any } {
    const input = this.node.properties.input

    if (Array.isArray(input)) {
      return { value: input }
    }

    if (isASTNode(input)) {
      const result = invoker.invokeSync(input.id, context)

      if (result.error) {
        return { error: result.error }
      }

      return { value: result.value }
    }

    return { value: input }
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
   * Filter (sync): Keep items where predicate evaluates to true.
   */
  private evaluateFilterSync(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): HandlerResult {
    const predicate = this.node.properties.iterator.predicateTemplate
    const results: unknown[] = []

    const validItems = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)

    for (const { item, index } of validItems) {
      const itemScope = this.createItemScope(item, index)

      const passesFilter = evaluateWithScopeSync(itemScope, context, () => {
        const predicateNode = hooks.instantiateTemplateValue(predicate)

        if (isASTNode(predicateNode)) {
          hooks.registerRuntimeNodesBatch([predicateNode], 'predicate')
          const result = invoker.invokeSync(predicateNode.id, context)

          return Boolean(result.value)
        }

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
   * Filter: Keep items where predicate evaluates to true.
   */
  private async evaluateFilter(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): Promise<HandlerResult> {
    const predicate = this.node.properties.iterator.predicateTemplate
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
        const predicateNode = hooks.instantiateTemplateValue(predicate)

        if (isASTNode(predicateNode)) {
          hooks.registerRuntimeNodesBatch([predicateNode], 'predicate')
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
   * Find (sync): Return first item where predicate evaluates to true.
   */
  private evaluateFindSync(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): HandlerResult {
    const predicate = this.node.properties.iterator.predicateTemplate

    const validItems = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)

    for (const { item, index } of validItems) {
      const itemScope = this.createItemScope(item, index)

      const matchesPredicate = evaluateWithScopeSync(itemScope, context, () => {
        const predicateNode = hooks.instantiateTemplateValue(predicate)

        if (isASTNode(predicateNode)) {
          hooks.registerRuntimeNodesBatch([predicateNode], 'predicate')
          const result = invoker.invokeSync(predicateNode.id, context)

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

    return {
      value: undefined,
      metadata: { source: 'IterateHandler.find.notFound' },
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
    const predicate = this.node.properties.iterator.predicateTemplate

    // Filter out null items and preserve indices
    const validItems = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)

    for (const { item, index } of validItems) {
      const itemScope = this.createItemScope(item, index)

      // eslint-disable-next-line no-await-in-loop
      const matchesPredicate = await evaluateWithScope(itemScope, context, async () => {
        const predicateNode = hooks.instantiateTemplateValue(predicate)

        if (isASTNode(predicateNode)) {
          hooks.registerRuntimeNodesBatch([predicateNode], 'predicate')
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
   * Map (sync): Transform each item using yield template.
   */
  private evaluateMapSync(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): HandlerResult {
    const yieldTemplate = this.node.properties.iterator.yieldTemplate
    const results: unknown[] = []

    // Phase 1: Create nodes for all items
    const nodesToEvaluate = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)
      .map(({ item, index }) => ({
        node: hooks.instantiateTemplateValue(yieldTemplate),
        itemScope: this.createItemScope(item, index),
      }))

    // Phase 2a: Resolve dynamic codes for each node
    if (this.templateYieldsFields) {
      for (const { node, itemScope } of nodesToEvaluate) {
        if (isASTNode(node)) {
          const fieldsWithExprCodes = this.findFieldsWithExpressionCodes(node)

          if (fieldsWithExprCodes.length > 0) {
            evaluateWithScopeSync(itemScope, context, () => {
              const exprNodes = fieldsWithExprCodes.map(f => f.properties.code as ASTNode)
              hooks.registerRuntimeNodesBatch(exprNodes, 'code')

              for (const field of fieldsWithExprCodes) {
                const codeNode = field.properties.code as ASTNode
                const result = invoker.invokeSync(codeNode.id, context)
                field.properties.code = String(result.value)
              }
            })
          }
        }
      }
    }

    // Phase 2b: Batch register all nodes
    const allNodes = nodesToEvaluate.map(({ node }) => node).filter(isASTNode)
    const nestedNodes = nodesToEvaluate.flatMap(({ node }) => (isASTNode(node) ? [] : this.findNestedASTNodes(node)))

    if (allNodes.length > 0) {
      hooks.registerRuntimeNodesBatch(allNodes, 'yield')
    }

    if (nestedNodes.length > 0) {
      hooks.registerRuntimeNodesBatch(nestedNodes, 'yield')
    }

    // Phase 3: Evaluate each with its scope
    for (const { node, itemScope } of nodesToEvaluate) {
      evaluateWithScopeSync(itemScope, context, () => {
        if (isASTNode(node)) {
          const result = invoker.invokeSync(node.id, context)
          results.push(result.value)
        } else {
          const evaluated = this.evaluateNestedNodesSync(node, invoker, context)
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
   * Map: Transform each item using yield template.
   */
  private async evaluateMap(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): Promise<HandlerResult> {
    const yieldTemplate = this.node.properties.iterator.yieldTemplate
    const results: unknown[] = []

    // Phase 1: Create nodes for all items (filter out nulls and preserve indices)
    const nodesToEvaluate = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)
      .map(({ item, index }) => ({
        node: hooks.instantiateTemplateValue(yieldTemplate),
        itemScope: this.createItemScope(item, index),
      }))

    // Phase 2a: Resolve dynamic codes for each node (needs scope per item for @index)
    // This must happen BEFORE batch registration so pseudo nodes are created correctly
    if (this.templateYieldsFields) {
      for (const { node, itemScope } of nodesToEvaluate) {
        if (isASTNode(node)) {
          const fieldsWithExprCodes = this.findFieldsWithExpressionCodes(node)

          if (fieldsWithExprCodes.length > 0) {
            evaluateWithScopeSync(itemScope, context, () => {
              const exprNodes = fieldsWithExprCodes.map(f => f.properties.code as ASTNode)
              hooks.registerRuntimeNodesBatch(exprNodes, 'code')

              for (const field of fieldsWithExprCodes) {
                const codeNode = field.properties.code as ASTNode
                const result = invoker.invokeSync(codeNode.id, context)
                field.properties.code = String(result.value)
              }
            })
          }
        }
      }
    }

    // Phase 2b: Batch register all nodes (codes are now resolved strings)
    const allNodes = nodesToEvaluate.map(({ node }) => node).filter(isASTNode)

    const nestedNodes = nodesToEvaluate.flatMap(({ node }) => (isASTNode(node) ? [] : this.findNestedASTNodes(node)))

    if (allNodes.length > 0) {
      hooks.registerRuntimeNodesBatch(allNodes, 'yield')
    }

    if (nestedNodes.length > 0) {
      hooks.registerRuntimeNodesBatch(nestedNodes, 'yield')
    }

    // Phase 3: Evaluate each with its scope
    for (const { node, itemScope } of nodesToEvaluate) {
      if (this.isTemplateAsync) {
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
      } else {
        evaluateWithScopeSync(itemScope, context, () => {
          if (isASTNode(node)) {
            const result = invoker.invokeSync(node.id, context)
            results.push(result.value)
          } else {
            const evaluated = this.evaluateNestedNodesSync(node, invoker, context)
            results.push(evaluated)
          }
        })
      }
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
   * Recursively evaluate a plain object by invoking any nested
   * AST nodes asynchronously and substituting their values.
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

      for (const [key, val] of Object.entries(value)) {
        // eslint-disable-next-line no-await-in-loop
        result[key] = await this.evaluateNestedNodes(val, invoker, context)
      }

      return result
    }

    return value
  }

  /**
   * Recursively evaluate a plain object synchronously by invoking any nested
   * AST nodes and substituting their values.
   */
  private evaluateNestedNodesSync(
    value: unknown,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (isASTNode(value)) {
      const result = invoker.invokeSync(value.id, context)
      return result.value
    }

    if (Array.isArray(value)) {
      return value.map(item => this.evaluateNestedNodesSync(item, invoker, context))
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {}

      Object.entries(value).forEach(([key, val]) => {
        result[key] = this.evaluateNestedNodesSync(val, invoker, context)
      })

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

    this.collectFieldsWithExpressionCodes(node, fields)

    return fields
  }

  private collectFieldsWithExpressionCodes(value: unknown, fields: ASTNode[]): void {
    if (value == null || typeof value !== 'object') {
      return
    }

    if (isASTNode(value)) {
      if (isFieldBlockStructNode(value) && isASTNode(value.properties.code)) {
        fields.push(value)
      }

      this.collectFieldsWithExpressionCodes(value.properties, fields)

      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.collectFieldsWithExpressionCodes(item, fields))

      return
    }

    Object.values(value as Record<string, unknown>).forEach(val => this.collectFieldsWithExpressionCodes(val, fields))
  }
}
