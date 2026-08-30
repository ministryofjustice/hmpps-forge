import { ComponentCallType, ExpressionType, FunctionEntryType, IteratorType } from '../../../../../shared/taxonomy'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { isTemplateASTNode } from '../../../contracts/ast/nodes'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { TemplateValue } from '../../../contracts/ast/template.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { FieldModel } from '../../../contracts/models/fieldModel.type'
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
  functionRegistry?: FunctionRegistry
}

interface JourneyContextOptions {
  journeyNode: JourneyASTNode
  stepNodes?: readonly StepASTNode[]
  nodeIndex?: ASTNodeIndex
  functionRegistry?: FunctionRegistry
}

interface FieldModelOptions {
  fieldBlocks?: readonly FieldBlockASTNode[]
  iterateNodes?: readonly IterateASTNode[]
  functionRegistry?: FunctionRegistry
}

/**
 * Builds a real `StepAnalysisContext` for analyzer tests. Ownership and field
 * models are derived from the registered nodes, and any component variant
 * used by the arranged blocks is auto-registered so tests that aren't about
 * component resolution don't fail on missing variants.
 */
export function createStepAnalysisContext(options: StepContextOptions): StepAnalysisContext {
  const nodeIndex = options.nodeIndex ?? new ASTNodeIndex()
  const functionRegistry = options.functionRegistry ?? new FunctionRegistry()
  const ownership = new OwnershipIndex(nodeIndex)
  const stepId = options.stepNode.id
  const fieldBlocks = ownership.fieldBlocksOf(stepId)
  const iterateNodes = ownership.mapIterateNodesOf(stepId)

  ensureVariantsRegistered(functionRegistry, fieldBlocks, iterateNodes)

  return {
    stepNode: options.stepNode,
    ownership,
    ancestry: new Ancestry(),
    registries: {
      functionRegistry,
    },
    classifier: new AuthoredValueClassifier(),
    fields: new FieldModelBuilder(functionRegistry).buildStepFields(fieldBlocks, iterateNodes),
    labels: new NodeLabeller(),
  }
}

/** Builds a real `JourneyAnalysisContext`, deriving owned steps and their field models. */
export function createJourneyAnalysisContext(options: JourneyContextOptions): JourneyAnalysisContext {
  const nodeIndex = options.nodeIndex ?? new ASTNodeIndex()
  const functionRegistry = options.functionRegistry ?? new FunctionRegistry()
  const ownership = new OwnershipIndex(nodeIndex)
  const stepNodes =
    options.stepNodes ??
    ownership.journeys().find(journey => journey.journeyNode === options.journeyNode)?.stepNodes ??
    []
  const fieldModelBuilder = new FieldModelBuilder(functionRegistry)
  const stepFields = new Map<NodeId, readonly FieldModel[]>()

  stepNodes.forEach(stepNode => {
    const fieldBlocks = ownership.fieldBlocksOf(stepNode.id)
    const iterateNodes = ownership.mapIterateNodesOf(stepNode.id)

    ensureVariantsRegistered(functionRegistry, fieldBlocks, iterateNodes)
    stepFields.set(stepNode.id, fieldModelBuilder.buildStepFields(fieldBlocks, iterateNodes))
  })

  return {
    journeyNode: options.journeyNode,
    stepNodes,
    ownership,
    ancestry: new Ancestry(),
    registries: {
      functionRegistry,
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
  const functionRegistry = options.functionRegistry ?? new FunctionRegistry()
  const fieldBlocks = options.fieldBlocks ?? []
  const iterateNodes = options.iterateNodes ?? []

  ensureVariantsRegistered(functionRegistry, fieldBlocks, iterateNodes)

  return new FieldModelBuilder(functionRegistry).buildStepFields(fieldBlocks, iterateNodes)
}

function ensureVariantsRegistered(
  functionRegistry: FunctionRegistry,
  fieldBlocks: readonly FieldBlockASTNode[],
  iterateNodes: readonly IterateASTNode[],
): void {
  const variants = new Set<string>()

  fieldBlocks.forEach(block => variants.add(block.variant))
  iterateNodes.forEach(iterateNode => {
    collectTemplateVariants(iterateNode.properties.iterator.yieldTemplate, variants)
  })

  const missingVariants = [...variants].filter(variant => variant !== '' && !functionRegistry.has(variant))

  functionRegistry.register(
    Object.fromEntries(
      missingVariants.map(name => [name, { name, _forge: FunctionEntryType.COMPONENT, evaluate: () => '' }]),
    ),
  )
}

function collectTemplateVariants(template: TemplateValue | undefined, variants: Set<string>): void {
  if (template === null || template === undefined || typeof template !== 'object') {
    return
  }

  if (isTemplateASTNode(template)) {
    if (template.kind === ComponentCallType.FIELD) {
      const templateData = template as unknown as Record<string, unknown>

      if (typeof templateData.variant === 'string') {
        variants.add(templateData.variant)
      }
    }

    if (template.kind === ExpressionType.ITERATE) {
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
