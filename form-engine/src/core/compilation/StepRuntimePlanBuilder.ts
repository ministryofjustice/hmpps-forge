import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import ValidationTemplateAnalyzer from '@form-engine/core/compilation/analyzers/ValidationTemplateAnalyzer'
import { NodeId } from '@form-engine/core/types/engine.type'
import { IterateASTNode } from '@form-engine/core/types/expressions.type'
import { FieldBlockASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
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
  renderAncestorIds: NodeId[]
  renderStepId: NodeId
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

    return {
      stepId: stepNode.id,
      accessAncestorIds,
      actionTransitionIds,
      submitTransitionIds,
      fieldIteratorRootIds,
      validationIterateNodeIds,
      validationBlockIds,
      renderAncestorIds: accessAncestorIds.slice(0, -1),
      renderStepId: stepNode.id,
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
}
