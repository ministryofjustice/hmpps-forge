import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import ThunkHandlerRegistry from '@form-engine/core/compilation/registries/ThunkHandlerRegistry'
import ValidationTemplateAnalyzer from '@form-engine/core/compilation/analyzers/ValidationTemplateAnalyzer'
import { NodeId } from '@form-engine/core/types/engine.type'
import { IterateASTNode, SubmitTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import getAncestorChain from '@form-engine/core/utils/getAncestorChain'
import { BlockType, ExpressionType } from '@form-engine/form/types/enums'

export interface StepRuntimePlan {
  stepId: NodeId
  accessAncestorIds: NodeId[]
  actionTransitionIds: NodeId[]
  submitTransitionIds: NodeId[]
  fieldIteratorRootIds: NodeId[]
  validationIterateNodeIds: NodeId[]
  validationBlockIds: NodeId[]
  domainValidationNodeIds: NodeId[]
  renderAncestorIds: NodeId[]
  renderStepId: NodeId
  isRenderSync: boolean
  isAnswerPrepareSync: boolean
  isValidationSync: boolean
  hasValidatingSubmitTransition: boolean
  hasDomainValidation: boolean
}

export default class StepRuntimePlanBuilder {
  build(stepNode: StepASTNode, compilationDependencies: CompilationDependencies): StepRuntimePlan {
    const accessAncestorIds = getAncestorChain(stepNode.id, compilationDependencies.metadataRegistry)
    const actionTransitionIds = (stepNode.properties.onAction ?? []).map(transition => transition.id)
    const submitTransitionIds = (stepNode.properties.onSubmission ?? []).map(transition => transition.id)
    const fieldIterateNodeIds = this.findFieldIterateNodeIds(compilationDependencies)
    const fieldIteratorRootIds = this.findIteratorRootIds(fieldIterateNodeIds, compilationDependencies)
    const validationIterateNodeIds = this.findValidationIterateNodeIds(fieldIterateNodeIds, compilationDependencies)
    const validationBlockIds = this.findValidationBlockIds(compilationDependencies)
    const domainValidationNodeIds = this.findDomainValidationNodeIds(stepNode)
    const renderAncestorIds = accessAncestorIds.slice(0, -1)

    return {
      stepId: stepNode.id,
      accessAncestorIds,
      actionTransitionIds,
      submitTransitionIds,
      fieldIteratorRootIds,
      validationIterateNodeIds,
      validationBlockIds,
      domainValidationNodeIds,
      renderAncestorIds,
      renderStepId: stepNode.id,
      isRenderSync: this.computeIsRenderSync(stepNode, renderAncestorIds, compilationDependencies),
      isAnswerPrepareSync: this.computeIsAnswerPrepareSync(fieldIteratorRootIds, compilationDependencies),
      isValidationSync: this.computeIsValidationSync(
        validationIterateNodeIds,
        validationBlockIds,
        domainValidationNodeIds,
        compilationDependencies,
      ),
      hasValidatingSubmitTransition: this.computeHasValidatingSubmitTransition(stepNode),
      hasDomainValidation: domainValidationNodeIds.length > 0,
    }
  }

  private findFieldIterateNodeIds(compilationDependencies: CompilationDependencies): NodeId[] {
    return compilationDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => compilationDependencies.metadataRegistry.get(node.id, 'isDescendantOfStep', false))
      .filter(node => ValidationTemplateAnalyzer.mayYieldFields(node.properties.iterator.yieldTemplate))
      .map(node => node.id)
  }

  private findIteratorRootIds(iterateNodeIds: NodeId[], compilationDependencies: CompilationDependencies): NodeId[] {
    const iteratorRootIds = new Set<NodeId>()

    iterateNodeIds
      .map(nodeId => compilationDependencies.nodeRegistry.get(nodeId) as IterateASTNode | undefined)
      .filter((node): node is IterateASTNode => node !== undefined)
      .forEach(node => {
        const rootId = this.findTopmostAncestorUnderStep(node.id, compilationDependencies)

        if (rootId !== undefined) {
          iteratorRootIds.add(rootId)
        }
      })

    return [...iteratorRootIds]
  }

  private findValidationIterateNodeIds(
    fieldIterateNodeIds: NodeId[],
    compilationDependencies: CompilationDependencies,
  ): NodeId[] {
    return fieldIterateNodeIds
      .map(nodeId => compilationDependencies.nodeRegistry.get(nodeId) as IterateASTNode | undefined)
      .filter((node): node is IterateASTNode => node !== undefined)
      .filter(node => ValidationTemplateAnalyzer.mayYieldValidatingFields(node.properties.iterator.yieldTemplate))
      .map(node => node.id)
  }

  private findDomainValidationNodeIds(stepNode: StepASTNode): NodeId[] {
    return (stepNode.properties.validate ?? []).map(node => node.id)
  }

  private findValidationBlockIds(compilationDependencies: CompilationDependencies): NodeId[] {
    return compilationDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
      .filter(node => compilationDependencies.metadataRegistry.get(node.id, 'isDescendantOfStep', false))
      .filter(node => Array.isArray(node.properties.validate) && node.properties.validate.length > 0)
      .map(node => node.id)
  }

  private findTopmostAncestorUnderStep(
    nodeId: NodeId,
    compilationDependencies: CompilationDependencies,
  ): NodeId | undefined {
    let currentId: NodeId | undefined = nodeId
    let topmostId: NodeId | undefined

    while (currentId !== undefined) {
      const parentId = compilationDependencies.metadataRegistry.get<NodeId>(currentId, 'attachedToParentNode')

      if (parentId === undefined) {
        break
      }

      if (compilationDependencies.metadataRegistry.get(parentId, 'isCurrentStep', false)) {
        topmostId = currentId
        break
      }

      topmostId = currentId
      currentId = parentId
    }

    return topmostId
  }

  private computeIsAnswerPrepareSync(
    fieldIteratorRootIds: NodeId[],
    compilationDependencies: CompilationDependencies,
  ): boolean {
    const handlerRegistry = compilationDependencies.thunkHandlerRegistry

    for (const rootId of fieldIteratorRootIds) {
      const handler = handlerRegistry.get(rootId)

      if (!handler || handler.isAsync) {
        return false
      }
    }

    const answerLocalNodes = compilationDependencies.nodeRegistry.findByType(PseudoNodeType.ANSWER_LOCAL)
    const answerRemoteNodes = compilationDependencies.nodeRegistry.findByType(PseudoNodeType.ANSWER_REMOTE)

    for (const node of [...answerLocalNodes, ...answerRemoteNodes]) {
      const handler = handlerRegistry.get(node.id)

      if (!handler || handler.isAsync) {
        return false
      }
    }

    return true
  }

  private computeIsRenderSync(
    stepNode: StepASTNode,
    renderAncestorIds: NodeId[],
    compilationDependencies: CompilationDependencies,
  ): boolean {
    const handlerRegistry = compilationDependencies.thunkHandlerRegistry
    const stepExcludedProps = new Set(['onAccess', 'onAction', 'onSubmission', 'blocks', 'validate'])
    const ancestorExcludedProps = new Set(['onAccess', 'children', 'steps'])

    const blocks = stepNode.properties.blocks ?? []

    if (!this.isValueTreeSync(blocks, handlerRegistry)) {
      return false
    }

    if (!this.areFilteredPropertiesSync(stepNode.properties, stepExcludedProps, handlerRegistry)) {
      return false
    }

    for (const ancestorId of renderAncestorIds) {
      const ancestorNode = compilationDependencies.nodeRegistry.get(ancestorId) as JourneyASTNode | undefined

      if (
        ancestorNode &&
        !this.areFilteredPropertiesSync(ancestorNode.properties, ancestorExcludedProps, handlerRegistry)
      ) {
        return false
      }
    }

    return true
  }

  private areFilteredPropertiesSync(
    properties: Record<string, unknown>,
    excludedKeys: Set<string>,
    handlerRegistry: ThunkHandlerRegistry,
  ): boolean {
    return Object.entries(properties)
      .filter(([key]) => !excludedKeys.has(key))
      .every(([, value]) => this.isValueTreeSync(value, handlerRegistry))
  }

  private computeIsValidationSync(
    validationIterateNodeIds: NodeId[],
    validationBlockIds: NodeId[],
    domainValidationNodeIds: NodeId[],
    compilationDependencies: CompilationDependencies,
  ): boolean {
    const handlerRegistry = compilationDependencies.thunkHandlerRegistry

    for (const iterateNodeId of validationIterateNodeIds) {
      const handler = handlerRegistry.get(iterateNodeId)

      if (!handler || handler.isAsync) {
        return false
      }
    }

    for (const blockId of validationBlockIds) {
      const block = compilationDependencies.nodeRegistry.get(blockId) as FieldBlockASTNode | undefined

      if (block) {
        if (!this.isValueTreeSync(block.properties.validate, handlerRegistry)) {
          return false
        }

        if (!this.isValueTreeSync(block.properties.dependent, handlerRegistry)) {
          return false
        }

        if (!this.isValueTreeSync(block.properties.code, handlerRegistry)) {
          return false
        }
      }
    }

    for (const nodeId of domainValidationNodeIds) {
      const handler = handlerRegistry.get(nodeId)

      if (!handler || handler.isAsync) {
        return false
      }
    }

    return true
  }

  private computeHasValidatingSubmitTransition(stepNode: StepASTNode): boolean {
    return (stepNode.properties.onSubmission ?? []).some(
      (transition: SubmitTransitionASTNode) => transition.properties.validate === true,
    )
  }

  private isValueTreeSync(value: unknown, handlerRegistry: ThunkHandlerRegistry): boolean {
    if (value === null || value === undefined) {
      return true
    }

    if (isASTNode(value)) {
      const handler = handlerRegistry.get(value.id)

      return handler !== undefined && !handler.isAsync
    }

    if (Array.isArray(value)) {
      return value.every(element => this.isValueTreeSync(element, handlerRegistry))
    }

    if (typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).every(v => this.isValueTreeSync(v, handlerRegistry))
    }

    return true
  }
}
