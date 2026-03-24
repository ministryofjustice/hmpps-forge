import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import ValidationTemplateAnalyzer from '@form-engine/core/compilation/analyzers/ValidationTemplateAnalyzer'
import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'
import ThunkEvaluationContext, {
  StepValidationFailure,
} from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { IterateASTNode, ValidationASTNode } from '@form-engine/core/types/expressions.type'
import { FieldBlockASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import getAncestorChain from '@form-engine/core/utils/getAncestorChain'
import { evaluateOperand } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { ValidationResult } from '@form-engine/core/nodes/expressions/validation/ValidationHandler'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { BlockType, ExpressionType } from '@form-engine/form/types/enums'

export interface ValidationExecutionResult {
  isValid: boolean
  failures: StepValidationFailure[]
}

export default class ValidationExecutor {
  async execute(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<ValidationExecutionResult> {
    const expandedIterateNodeIds = await this.expandValidationIterators(runtimePlan, invoker, context)
    const fieldBlocks = this.collectValidationFieldBlocks(runtimePlan, expandedIterateNodeIds, context)
    const failures = await this.collectValidationFailures(fieldBlocks, invoker, context)

    return {
      isValid: failures.length === 0,
      failures,
    }
  }

  private async expandValidationIterators(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<NodeId[]> {
    const pendingIterateNodeIds = [...runtimePlan.validationIterateNodeIds]
    const expandedIterateNodeIds: NodeId[] = []
    const seenIterateNodeIds = new Set<NodeId>()

    while (pendingIterateNodeIds.length > 0) {
      const iterateNodeId = pendingIterateNodeIds.shift()

      if (iterateNodeId !== undefined && !seenIterateNodeIds.has(iterateNodeId)) {
        seenIterateNodeIds.add(iterateNodeId)
        expandedIterateNodeIds.push(iterateNodeId)

        // eslint-disable-next-line no-await-in-loop
        await invoker.invoke(iterateNodeId, context)

        const nestedIterateNodeIds = this.findNestedValidationIterateNodeIds(iterateNodeId, context)

        nestedIterateNodeIds.forEach(nestedIterateNodeId => {
          if (!seenIterateNodeIds.has(nestedIterateNodeId)) {
            pendingIterateNodeIds.push(nestedIterateNodeId)
          }
        })
      }
    }

    return expandedIterateNodeIds
  }

  private collectValidationFieldBlocks(
    runtimePlan: StepRuntimePlan,
    expandedIterateNodeIds: NodeId[],
    context: ThunkEvaluationContext,
  ): FieldBlockASTNode[] {
    const blockById = new Map<NodeId, FieldBlockASTNode>()

    runtimePlan.validationBlockIds
      .map(blockId => context.nodeRegistry.get(blockId) as FieldBlockASTNode | undefined)
      .filter((block): block is FieldBlockASTNode => block !== undefined)
      .forEach(block => {
        blockById.set(block.id, block)
      })

    if (expandedIterateNodeIds.length === 0) {
      return [...blockById.values()]
    }

    const expandedIterateNodeIdSet = new Set(expandedIterateNodeIds)

    context.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
      .filter(block => {
        const ancestors = getAncestorChain(block.id, context.metadataRegistry)

        return ancestors.some(ancestorId => expandedIterateNodeIdSet.has(ancestorId))
      })
      .filter(block => Array.isArray(block.properties.validate) && block.properties.validate.length > 0)
      .forEach(block => {
        blockById.set(block.id, block)
      })

    return this.sortByDocumentOrder([...blockById.values()], runtimePlan, context)
  }

  private sortByDocumentOrder(
    fieldBlocks: FieldBlockASTNode[],
    runtimePlan: StepRuntimePlan,
    context: ThunkEvaluationContext,
  ): FieldBlockASTNode[] {
    const stepNode = context.nodeRegistry.get(runtimePlan.stepId) as StepASTNode | undefined
    const topLevelBlocks = stepNode?.properties.blocks

    if (!topLevelBlocks?.length) {
      return fieldBlocks
    }

    const positionIndex = new Map<NodeId, number>()

    topLevelBlocks.forEach((block, index) => {
      positionIndex.set(block.id, index)
    })

    const fieldPositions = fieldBlocks.map((field, originalIndex) => {
      const ancestors = getAncestorChain(field.id, context.metadataRegistry)
      const stepIndex = ancestors.indexOf(runtimePlan.stepId)
      const topLevelId = stepIndex >= 0 && stepIndex < ancestors.length - 1 ? ancestors[stepIndex + 1] : undefined
      const position = topLevelId !== undefined ? (positionIndex.get(topLevelId) ?? -1) : -1

      return { field, position, originalIndex }
    })

    fieldPositions.sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position
      }

      return a.originalIndex - b.originalIndex
    })

    return fieldPositions.map(({ field }) => field)
  }

  private async collectValidationFailures(
    fieldBlocks: FieldBlockASTNode[],
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<StepValidationFailure[]> {
    if (fieldBlocks.length === 0) {
      return []
    }

    const blockFailures = await Promise.all(fieldBlocks.map(block => this.evaluateFieldBlock(block, invoker, context)))

    return blockFailures.flat()
  }

  private async evaluateFieldBlock(
    block: FieldBlockASTNode,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<StepValidationFailure[]> {
    const isDependentActive = await this.isDependentActive(block, invoker, context)

    if (!isDependentActive) {
      return []
    }

    const validations = await this.evaluateValidationNodes(block, invoker, context)

    if (validations.length === 0) {
      return []
    }

    const blockCode = await this.evaluateBlockCode(block, invoker, context)

    return validations
      .filter(validation => validation.passed === false)
      .map(validation => ({
        ...validation,
        blockId: block.id,
        blockCode: validation.blockCode ?? blockCode,
      }))
  }

  private async isDependentActive(
    block: FieldBlockASTNode,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<boolean> {
    if (block.properties.dependent === undefined) {
      return true
    }

    return Boolean(await evaluateOperand(block.properties.dependent, context, invoker))
  }

  private async evaluateBlockCode(
    block: FieldBlockASTNode,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<string | undefined> {
    const code = await evaluateOperand(block.properties.code, context, invoker)

    if (typeof code === 'string') {
      return code
    }

    return undefined
  }

  private async evaluateValidationNodes(
    block: FieldBlockASTNode,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<ValidationResult[]> {
    const validationNodes = (block.properties.validate ?? [])
      .filter((validation): validation is ValidationASTNode => isASTNode(validation))

    if (validationNodes.length === 0) {
      return []
    }

    const results = await Promise.all(
      validationNodes.map(async validationNode => invoker.invoke(validationNode.id, context)),
    )

    return results
      .filter(result => !result.error && result.value !== undefined)
      .map(result => result.value as ValidationResult)
  }

  private findNestedValidationIterateNodeIds(parentIterateNodeId: NodeId, context: ThunkEvaluationContext): NodeId[] {
    return (
      context.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
        .filter(node => node.id !== parentIterateNodeId)
        .filter(node => {
          const ancestors = getAncestorChain(node.id, context.metadataRegistry)

          return ancestors.includes(parentIterateNodeId)
        })
        .filter(node => ValidationTemplateAnalyzer.mayYieldValidatingFields(node.properties.iterator.yieldTemplate))
        .map(node => node.id)
    )
  }
}
