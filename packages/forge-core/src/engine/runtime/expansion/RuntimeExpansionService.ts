import TemplateFactory from '../../nodes/template/TemplateFactory'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { PreparedIteratorExpansion } from './RuntimeExpansionState.type'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import registerRuntimeNodes from './registerRuntimeNodes'
import { NodeId, ASTNode } from '../../types/engine.type'
import { IterateASTNode } from '../../types/expressions.type'
import { FieldBlockASTNode } from '../../types/structures.type'
import { IteratorType } from '../../../authoring/types/enums'
import { evaluateWithScope } from '../../utils/thunkEvaluatorsAsync'
import { isASTNode } from '../../typeguards/nodes'
import { isIterateExprNode } from '../../typeguards/expression-nodes'
import { isFieldBlockStructNode } from '../../typeguards/structure-nodes'
import ThunkTypeMismatchError from '../../errors/ThunkTypeMismatchError'
import { ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'

export default class RuntimeExpansionService {
  async expandAllForPlan(
    entries: ReachabilityStepEntry[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<void> {
    const allIterateNodeIds = entries.flatMap(entry => entry.iterateNodeIds)

    await this.expandIteratorRoots(allIterateNodeIds, context, invoker)
  }

  async refreshExpansion(
    iterateNodeIds: NodeId[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<void> {
    context.runtimeExpansionState.preparedIterators.clear()
    context.runtimeExpansionState.expandedIteratorIds.clear()

    await this.expandIteratorRoots(iterateNodeIds, context, invoker)
  }

  async expandIteratorRoots(
    rootIds: NodeId[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<NodeId[]> {
    const expandedNodeIds = new Set<NodeId>()

    for (const rootId of rootIds) {
      const nodeIds = await this.expandIteratorRoot(rootId, context, invoker)

      nodeIds.forEach(nodeId => {
        expandedNodeIds.add(nodeId)
      })
    }

    return [...expandedNodeIds]
  }

  private async expandIteratorRoot(
    nodeId: NodeId,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<NodeId[]> {
    const iterateNode = context.nodeRegistry.get(nodeId)

    if (!isIterateExprNode(iterateNode) || iterateNode.properties.iterator.type !== IteratorType.MAP) {
      return []
    }

    if (context.runtimeExpansionState.expandedIteratorIds.has(nodeId)) {
      return this.collectExpandedIteratorIds(nodeId, context)
    }

    const inputResult = await this.evaluateInput(iterateNode, context, invoker)

    if ('error' in inputResult) {
      throw inputResult.error.cause ?? new Error(inputResult.error.message)
    }

    const inputArray = this.normalizeToArray(inputResult.value)

    if (inputArray === undefined) {
      throw (
        ThunkTypeMismatchError.value(nodeId, 'array or object', typeof inputResult.value).toThunkError().cause ??
        new Error(`Iterator expansion requires an array or object input (nodeId: ${nodeId})`)
      )
    }

    const preparedExpansion = this.instantiatePreparedItems(iterateNode, inputArray)

    await this.resolveDynamicFieldCodes(iterateNode, preparedExpansion, context, invoker)

    const registeredNodeIds = this.registerPreparedItems(iterateNode.id, preparedExpansion, context)

    context.runtimeExpansionState.preparedIterators.set(nodeId, preparedExpansion)
    context.runtimeExpansionState.expandedIteratorIds.add(nodeId)

    const expandedNodeIds = new Set<NodeId>([nodeId])
    const nestedIteratorIds = this.findNestedMapIteratorIds(registeredNodeIds, context)

    for (const nestedIteratorId of nestedIteratorIds) {
      const nestedNodeIds = await this.expandIteratorRoot(nestedIteratorId, context, invoker)

      nestedNodeIds.forEach(expandedNodeId => {
        expandedNodeIds.add(expandedNodeId)
      })
    }

    return [...expandedNodeIds]
  }

  private async evaluateInput(
    iterateNode: IterateASTNode,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<{ value: unknown } | { error: any }> {
    const input = iterateNode.properties.input

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

  private instantiatePreparedItems(iterateNode: IterateASTNode, inputArray: unknown[]): PreparedIteratorExpansion {
    const items = inputArray
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item != null)
      .map(({ item, index }) => ({
        itemScope: this.createItemScope(item, index),
        yieldValue: TemplateFactory.instantiate(iterateNode.properties.iterator.yieldTemplate),
      }))

    return { items }
  }

  private async resolveDynamicFieldCodes(
    iterateNode: IterateASTNode,
    preparedExpansion: PreparedIteratorExpansion,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<void> {
    for (const item of preparedExpansion.items) {
      const fieldsWithExprCodes = this.findFieldsWithExpressionCodes(item.yieldValue)

      if (fieldsWithExprCodes.length === 0) {
        continue
      }

      await evaluateWithScope(item.itemScope, context, async () => {
        const exprNodes = fieldsWithExprCodes.map(field => field.properties.code as ASTNode)

        registerRuntimeNodes(context, iterateNode.id, exprNodes, 'code')

        await Promise.all(
          fieldsWithExprCodes.map(async field => {
            const codeNode = field.properties.code as ASTNode
            const result = await invoker.invoke(codeNode.id, context)

            if (result.error) {
              throw result.error.cause ?? new Error(result.error.message)
            }

            field.properties.code = String(result.value)
          }),
        )
      })
    }
  }

  private registerPreparedItems(
    iterateNodeId: NodeId,
    preparedExpansion: PreparedIteratorExpansion,
    context: ThunkEvaluationContext,
  ): NodeId[] {
    const directNodes = preparedExpansion.items
      .map(item => item.yieldValue)
      .filter(isASTNode)
    const nestedNodes = preparedExpansion.items.flatMap(item => {
      if (isASTNode(item.yieldValue)) {
        return []
      }

      return this.findNestedASTNodes(item.yieldValue)
    })
    const registeredNodeIds = new Set<NodeId>()

    if (directNodes.length > 0) {
      registerRuntimeNodes(context, iterateNodeId, directNodes, 'yield').forEach(nodeId => {
        registeredNodeIds.add(nodeId)
      })
    }

    if (nestedNodes.length > 0) {
      registerRuntimeNodes(context, iterateNodeId, nestedNodes, 'yield').forEach(nodeId => {
        registeredNodeIds.add(nodeId)
      })
    }

    return [...registeredNodeIds]
  }

  private findNestedMapIteratorIds(registeredNodeIds: NodeId[], context: ThunkEvaluationContext): NodeId[] {
    return [
      ...new Set(
        registeredNodeIds
          .map(nodeId => context.nodeRegistry.get(nodeId))
          .filter(isIterateExprNode)
          .filter(node => node.properties.iterator.type === IteratorType.MAP)
          .map(node => node.id),
      ),
    ]
  }

  private collectExpandedIteratorIds(nodeId: NodeId, context: ThunkEvaluationContext): NodeId[] {
    return [...context.runtimeExpansionState.expandedIteratorIds].filter(expandedNodeId => {
      return expandedNodeId === nodeId || context.astNodeTree.isDescendantOf(expandedNodeId, nodeId)
    })
  }

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

  private createItemScope(item: unknown, index: number): Record<string, unknown> {
    const scope: Record<string, unknown> = typeof item === 'object' && item !== null ? { ...item } : { '@value': item }

    scope['@index'] = index
    scope['@type'] = 'iterator'
    scope['@item'] = item

    return scope
  }

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
      Object.values(value).forEach(item => {
        nodes.push(...this.findNestedASTNodes(item))
      })
    }

    return nodes
  }

  private findFieldsWithExpressionCodes(value: unknown): FieldBlockASTNode[] {
    const fields: FieldBlockASTNode[] = []

    this.collectFieldsWithExpressionCodes(value, fields)

    return fields
  }

  private collectFieldsWithExpressionCodes(value: unknown, fields: FieldBlockASTNode[]): void {
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
      value.forEach(item => {
        this.collectFieldsWithExpressionCodes(item, fields)
      })

      return
    }

    Object.values(value as Record<string, unknown>).forEach(item => {
      this.collectFieldsWithExpressionCodes(item, fields)
    })
  }
}
