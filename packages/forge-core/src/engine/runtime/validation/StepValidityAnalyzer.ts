import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext, {
  DomainValidationFailure,
  StepValidationFailure,
} from '../../compilation/thunks/ThunkEvaluationContext'
import { ValidationASTNode } from '../../types/expressions.type'
import { FieldBlockASTNode, StepASTNode } from '../../types/structures.type'
import { NodeId } from '../../types/ast.type'
import getAncestorChain from '../../utils/getAncestorChain'
import { evaluateOperand } from '../../utils/thunkEvaluatorsAsync'
import { ValidationResult } from '../../nodes/expressions/validation/ValidationHandler'
import { isASTNode } from '../../typeguards/nodes'
import { BlockType } from '../../../authoring/types/enums'

export type StepValidityPlan = Pick<StepRuntimePlan, 'stepId' | 'validationBlockIds' | 'domainValidationNodeIds'>

export interface StepValidityResult {
  isValid: boolean
  fieldFailures: StepValidationFailure[]
  domainFailures: DomainValidationFailure[]
}

export default class StepValidityAnalyzer {
  async execute(
    runtimePlan: StepValidityPlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    isSubmission = false,
  ): Promise<StepValidityResult> {
    const fieldBlocks = this.collectValidationFieldBlocks(runtimePlan, context)
    const fieldFailures = await this.collectValidationFailures(fieldBlocks, isSubmission, invoker, context)
    const domainFailures = await this.collectDomainValidationFailures(runtimePlan, invoker, context)

    return {
      isValid: fieldFailures.length === 0 && domainFailures.length === 0,
      fieldFailures,
      domainFailures,
    }
  }

  private collectValidationFieldBlocks(
    runtimePlan: StepValidityPlan,
    context: ThunkEvaluationContext,
  ): FieldBlockASTNode[] {
    const fieldBlocks = context.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
      .filter(block => context.astNodeTree.isDescendantOf(block.id, runtimePlan.stepId))
      .filter(block => Array.isArray(block.properties.validWhen) && block.properties.validWhen.length > 0)

    if (fieldBlocks.length === 0) {
      return []
    }

    return this.sortByDocumentOrder(fieldBlocks, runtimePlan, context)
  }

  private sortByDocumentOrder(
    fieldBlocks: FieldBlockASTNode[],
    runtimePlan: StepValidityPlan,
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
    isSubmission: boolean,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<StepValidationFailure[]> {
    if (fieldBlocks.length === 0) {
      return []
    }

    const blockFailures = await Promise.all(
      fieldBlocks.map(block => this.evaluateFieldBlock(block, isSubmission, invoker, context)),
    )

    return blockFailures.flat()
  }

  private async evaluateFieldBlock(
    block: FieldBlockASTNode,
    isSubmission: boolean,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<StepValidationFailure[]> {
    const isDependentActive = await this.isDependentActive(block, invoker, context)

    if (!isDependentActive) {
      return []
    }

    const validations = await this.evaluateValidationNodes(block, isSubmission, invoker, context)

    if (validations.length === 0) {
      return []
    }

    const blockCode = await this.evaluateBlockCode(block, invoker, context)

    return validations
      .filter(validation => !validation.passed)
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
    if (block.properties.dependentWhen === undefined) {
      return true
    }

    return Boolean(await evaluateOperand(block.properties.dependentWhen, context, invoker))
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
    isSubmission: boolean,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<ValidationResult[]> {
    const validationNodes = (block.properties.validWhen ?? [])
      .filter((validation): validation is ValidationASTNode => isASTNode(validation))
      .filter(validation => isSubmission || !validation.properties.submissionOnly)

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

  private async collectDomainValidationFailures(
    runtimePlan: StepValidityPlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<DomainValidationFailure[]> {
    if (runtimePlan.domainValidationNodeIds.length === 0) {
      return []
    }

    const results = await Promise.all(
      runtimePlan.domainValidationNodeIds.map(async nodeId => invoker.invoke(nodeId, context)),
    )

    return results
      .filter(result => !result.error && result.value !== undefined)
      .flatMap(result => (Array.isArray(result.value) ? result.value : [result.value]))
      .filter(this.isFailedValidation)
  }

  private isFailedValidation(value: unknown): value is ValidationResult {
    return value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      'passed' in value &&
      !(value as ValidationResult).passed
  }
}
