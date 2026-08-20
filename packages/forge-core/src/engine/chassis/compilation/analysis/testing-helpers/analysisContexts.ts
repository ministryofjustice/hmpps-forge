import { BlockType, ExpressionType, IteratorType } from '../../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { TemplateValue } from '../../../contracts/ast/template.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { FieldModel } from '../../../contracts/models/fieldModel.type'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import type { JourneyAnalysisContext, StepAnalysisContext } from '../concernAnalyzers.type'
import Ancestry from '../shared/Ancestry'
import AuthoredValueClassifier from '../shared/AuthoredValueClassifier'
import FieldModelBuilder from '../shared/FieldModelBuilder'
import NodeLabeller from '../shared/NodeLabeller'
import OwnershipIndex from '../shared/OwnershipIndex'

interface StepContextOptions {
  stepNode: StepASTNode
  nodeIndex?: ASTNodeIndex
  componentRegistry?: ComponentRegistry
  functionRegistry?: FunctionRegistry
}

interface JourneyContextOptions {
  journeyNode: JourneyASTNode
  stepNodes?: readonly StepASTNode[]
  nodeIndex?: ASTNodeIndex
  componentRegistry?: ComponentRegistry
  functionRegistry?: FunctionRegistry
}

interface FieldModelOptions {
  fieldBlocks?: readonly FieldBlockASTNode[]
  iterateNodes?: readonly IterateASTNode[]
  componentRegistry?: ComponentRegistry
}

/**
 * Builds a real `StepAnalysisContext` for analyzer tests. Ownership and field
 * models are derived from the registered nodes, and any component variant
 * used by the arranged blocks is auto-registered so tests that aren't about
 * component resolution don't fail on missing variants.
 */
export function createStepAnalysisContext(options: StepContextOptions): StepAnalysisContext {
  const nodeIndex = options.nodeIndex ?? new ASTNodeIndex()
  const componentRegistry = options.componentRegistry ?? new ComponentRegistry()
  const ownership = new OwnershipIndex(nodeIndex)
  const stepId = options.stepNode.id
  const fieldBlocks = ownership.fieldBlocksOf(stepId)
  const iterateNodes = ownership.mapIterateNodesOf(stepId)

  ensureVariantsRegistered(componentRegistry, fieldBlocks, iterateNodes)

  return {
    stepNode: options.stepNode,
    ownership,
    ancestry: new Ancestry(),
    registries: {
      componentRegistry,
      functionRegistry: options.functionRegistry ?? new FunctionRegistry(),
    },
    classifier: new AuthoredValueClassifier(),
    fields: new FieldModelBuilder(componentRegistry).buildStepFields(fieldBlocks, iterateNodes),
    labels: new NodeLabeller(),
  }
}

/** Builds a real `JourneyAnalysisContext`, deriving owned steps and their field models. */
export function createJourneyAnalysisContext(options: JourneyContextOptions): JourneyAnalysisContext {
  const nodeIndex = options.nodeIndex ?? new ASTNodeIndex()
  const componentRegistry = options.componentRegistry ?? new ComponentRegistry()
  const ownership = new OwnershipIndex(nodeIndex)
  const stepNodes =
    options.stepNodes ??
    ownership.journeys().find(journey => journey.journeyNode === options.journeyNode)?.stepNodes ??
    []
  const fieldModelBuilder = new FieldModelBuilder(componentRegistry)
  const stepFields = new Map<NodeId, readonly FieldModel[]>()

  stepNodes.forEach(stepNode => {
    const fieldBlocks = ownership.fieldBlocksOf(stepNode.id)
    const iterateNodes = ownership.mapIterateNodesOf(stepNode.id)

    ensureVariantsRegistered(componentRegistry, fieldBlocks, iterateNodes)
    stepFields.set(stepNode.id, fieldModelBuilder.buildStepFields(fieldBlocks, iterateNodes))
  })

  return {
    journeyNode: options.journeyNode,
    stepNodes,
    ownership,
    ancestry: new Ancestry(),
    registries: {
      componentRegistry,
      functionRegistry: options.functionRegistry ?? new FunctionRegistry(),
    },
    classifier: new AuthoredValueClassifier(),
    labels: new NodeLabeller(),
    stepFields,
  }
}

/**
 * Builds field models directly from block and iterate nodes, without needing
 * an `ASTNodeIndex`. Useful for compiler tests that construct nodes by hand.
 */
export function buildStepFieldModels(options: FieldModelOptions): FieldModel[] {
  const componentRegistry = options.componentRegistry ?? new ComponentRegistry()
  const fieldBlocks = options.fieldBlocks ?? []
  const iterateNodes = options.iterateNodes ?? []

  ensureVariantsRegistered(componentRegistry, fieldBlocks, iterateNodes)

  return new FieldModelBuilder(componentRegistry).buildStepFields(fieldBlocks, iterateNodes)
}

function ensureVariantsRegistered(
  componentRegistry: ComponentRegistry,
  fieldBlocks: readonly FieldBlockASTNode[],
  iterateNodes: readonly IterateASTNode[],
): void {
  const variants = new Set<string>()

  fieldBlocks.forEach(block => variants.add(block.variant))
  iterateNodes.forEach(iterateNode => {
    collectTemplateVariants(iterateNode.properties.iterator.yieldTemplate, variants)
  })

  const missingVariants = [...variants].filter(variant => variant !== '' && !componentRegistry.has(variant))

  componentRegistry.registerMany(missingVariants.map(variant => ({ variant, render: () => '' })))
}

function collectTemplateVariants(template: TemplateValue | undefined, variants: Set<string>): void {
  if (template === null || template === undefined || typeof template !== 'object') {
    return
  }

  if (isTemplateNode(template)) {
    if (template.originalType === ASTNodeType.BLOCK && template.blockType === BlockType.FIELD) {
      if (typeof template.variant === 'string') {
        variants.add(template.variant)
      }
    }

    if (template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE) {
      const iterator = (template.properties ?? {}).iterator as
        | { type?: unknown; yieldTemplate?: TemplateValue }
        | undefined

      if (iterator?.type === IteratorType.MAP) {
        collectTemplateVariants(iterator.yieldTemplate, variants)
      }

      return
    }

    Object.values(template.properties ?? {}).forEach(child => collectTemplateVariants(child as TemplateValue, variants))

    return
  }

  if (Array.isArray(template)) {
    template.forEach(item => collectTemplateVariants(item, variants))

    return
  }

  Object.values(template as Record<string, TemplateValue>).forEach(item => collectTemplateVariants(item, variants))
}
