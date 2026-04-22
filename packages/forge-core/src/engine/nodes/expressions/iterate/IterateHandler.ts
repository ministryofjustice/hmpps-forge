import { NodeId } from '../../../types/engine.type'
import { IterateASTNode } from '../../../types/expressions.type'
import { IteratorType } from '../../../../authoring/types/enums'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '../../../compilation/thunks/types'
import ThunkEvaluationContext from '../../../compilation/thunks/ThunkEvaluationContext'
import ThunkTypeMismatchError from '../../../errors/ThunkTypeMismatchError'
import registerRuntimeNodes from '../../../runtime/expansion/registerRuntimeNodes'
import TemplateFactory from '../../template/TemplateFactory'
import { evaluateWithScope } from '../../../utils/thunkEvaluatorsAsync'
import { evaluateWithScopeSync } from '../../../utils/thunkEvaluatorsSync'
import { isASTNode } from '../../../typeguards/nodes'
import TemplateAsyncAnalyzer from '../../../compilation/analyzers/TemplateAsyncAnalyzer'

/**
 * Handler for Iterate expressions
 *
 * Evaluates input array and applies iterator operation per item:
 * - MAP: Transform each item using pre-expanded yield nodes from RuntimeExpansionService
 * - FILTER: Keep items where predicate is true
 * - FIND: Return first item where predicate is true
 *
 * Uses scope management to enable Item() references within predicates and yields.
 *
 * Sync-capable when input node and template contents are both sync.
 * Template async status is determined at compile time via TemplateAsyncAnalyzer
 * and stored in metadata for use during runtime node registration.
 */
export default class IterateHandler implements ThunkHandler {
  isAsync = false

  private isTemplateAsync = false

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
    deps.metadataRegistry.set(this.nodeId, 'isTemplateAsync', this.isTemplateAsync)
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const inputResult = this.evaluateInputSync(context, invoker)

    if ('error' in inputResult) {
      return { error: inputResult.error }
    }

    const inputArray = this.normalizeToArray(inputResult.value)

    if (inputArray === undefined) {
      const error = ThunkTypeMismatchError.value(this.nodeId, 'array or object', typeof inputResult.value)
      return { error: error.toThunkError() }
    }

    const iteratorType = this.node.properties.iterator.type

    if (inputArray.length === 0) {
      if (iteratorType === IteratorType.FIND) {
        return { value: undefined, metadata: { source: 'IterateHandler.find.empty' } }
      }

      return { value: [], metadata: { source: 'IterateHandler.empty' } }
    }

    if (iteratorType === IteratorType.FILTER) {
      return this.evaluateFilterSync(inputArray, context, invoker)
    }

    if (iteratorType === IteratorType.MAP) {
      return this.evaluateMapSync(context, invoker)
    }

    if (iteratorType === IteratorType.FIND) {
      return this.evaluateFindSync(inputArray, context, invoker)
    }

    const error = ThunkTypeMismatchError.value(this.nodeId, 'valid iterator type', iteratorType)
    return { error: error.toThunkError() }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const inputResult = await this.evaluateInput(context, invoker)

    if ('error' in inputResult) {
      return { error: inputResult.error }
    }

    const inputArray = this.normalizeToArray(inputResult.value)

    if (inputArray === undefined) {
      const error = ThunkTypeMismatchError.value(this.nodeId, 'array or object', typeof inputResult.value)
      return { error: error.toThunkError() }
    }

    const iteratorType = this.node.properties.iterator.type

    if (inputArray.length === 0) {
      if (iteratorType === IteratorType.FIND) {
        return { value: undefined, metadata: { source: 'IterateHandler.find.empty' } }
      }

      return { value: [], metadata: { source: 'IterateHandler.empty' } }
    }

    if (iteratorType === IteratorType.FILTER) {
      return this.evaluateFilter(inputArray, context, invoker)
    }

    if (iteratorType === IteratorType.MAP) {
      return this.evaluateMap(context, invoker)
    }

    if (iteratorType === IteratorType.FIND) {
      return this.evaluateFind(inputArray, context, invoker)
    }

    const error = ThunkTypeMismatchError.value(this.nodeId, 'valid iterator type', iteratorType)
    return { error: error.toThunkError() }
  }

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

  private async evaluateInput(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<{ value: unknown } | { error: any }> {
    const input = this.node.properties.input

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

    return { value: input }
  }

  private evaluateFilterSync(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): HandlerResult {
    const predicate = this.node.properties.iterator.predicateTemplate
    const results: unknown[] = []

    const validItems = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)

    for (const { item, index } of validItems) {
      const itemScope = this.createItemScope(item, index)

      const passesFilter = evaluateWithScopeSync(itemScope, context, () => {
        const predicateNode = TemplateFactory.instantiate(predicate)

        if (isASTNode(predicateNode)) {
          registerRuntimeNodes(context, this.nodeId, [predicateNode], 'predicate')
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

  private async evaluateFilter(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult> {
    const predicate = this.node.properties.iterator.predicateTemplate
    const results: unknown[] = []

    const validItems = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)

    for (const { item, index } of validItems) {
      const itemScope = this.createItemScope(item, index)

      const passesFilter = await evaluateWithScope(itemScope, context, async () => {
        const predicateNode = TemplateFactory.instantiate(predicate)

        if (isASTNode(predicateNode)) {
          registerRuntimeNodes(context, this.nodeId, [predicateNode], 'predicate')
          const result = await invoker.invoke(predicateNode.id, context)

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

  private evaluateFindSync(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): HandlerResult {
    const predicate = this.node.properties.iterator.predicateTemplate

    const validItems = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)

    for (const { item, index } of validItems) {
      const itemScope = this.createItemScope(item, index)

      const matchesPredicate = evaluateWithScopeSync(itemScope, context, () => {
        const predicateNode = TemplateFactory.instantiate(predicate)

        if (isASTNode(predicateNode)) {
          registerRuntimeNodes(context, this.nodeId, [predicateNode], 'predicate')
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

  private async evaluateFind(
    inputArray: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult> {
    const predicate = this.node.properties.iterator.predicateTemplate

    const validItems = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)

    for (const { item, index } of validItems) {
      const itemScope = this.createItemScope(item, index)

      const matchesPredicate = await evaluateWithScope(itemScope, context, async () => {
        const predicateNode = TemplateFactory.instantiate(predicate)

        if (isASTNode(predicateNode)) {
          registerRuntimeNodes(context, this.nodeId, [predicateNode], 'predicate')
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

    return {
      value: undefined,
      metadata: { source: 'IterateHandler.find.notFound' },
    }
  }

  private evaluateMapSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const cachedExpansion = context.runtimeExpansionState.preparedIterators.get(this.nodeId)

    if (!cachedExpansion) {
      throw new Error(`MAP iterator was not pre-expanded by RuntimeExpansionService (nodeId: ${this.nodeId})`)
    }

    const results: unknown[] = []

    for (const { yieldValue, itemScope } of cachedExpansion.items) {
      evaluateWithScopeSync(itemScope, context, () => {
        if (isASTNode(yieldValue)) {
          const result = invoker.invokeSync(yieldValue.id, context)
          results.push(result.value)
        } else {
          const evaluated = this.evaluateNestedNodesSync(yieldValue, invoker, context)
          results.push(evaluated)
        }
      })
    }

    return {
      value: results,
      metadata: { source: 'IterateHandler.map' },
    }
  }

  private async evaluateMap(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const cachedExpansion = context.runtimeExpansionState.preparedIterators.get(this.nodeId)

    if (!cachedExpansion) {
      throw new Error(`MAP iterator was not pre-expanded by RuntimeExpansionService (nodeId: ${this.nodeId})`)
    }

    const results: unknown[] = []

    for (const { yieldValue, itemScope } of cachedExpansion.items) {
      if (this.isTemplateAsync) {
        await evaluateWithScope(itemScope, context, async () => {
          if (isASTNode(yieldValue)) {
            const result = await invoker.invoke(yieldValue.id, context)
            results.push(result.value)
          } else {
            const evaluated = await this.evaluateNestedNodes(yieldValue, invoker, context)
            results.push(evaluated)
          }
        })
      } else {
        evaluateWithScopeSync(itemScope, context, () => {
          if (isASTNode(yieldValue)) {
            const result = invoker.invokeSync(yieldValue.id, context)
            results.push(result.value)
          } else {
            const evaluated = this.evaluateNestedNodesSync(yieldValue, invoker, context)
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
    if (input === undefined || input === null) {
      return []
    }

    if (Array.isArray(input)) {
      return input
    }

    if (typeof input === 'object') {
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
        result[key] = await this.evaluateNestedNodes(val, invoker, context)
      }

      return result
    }

    return value
  }

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
}
