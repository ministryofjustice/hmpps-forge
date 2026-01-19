import { NodeId } from '@form-engine/core/types/engine.type'
import { EvaluationResult } from '@form-engine/core/compilation/thunks/ThunkEvaluator'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import getAncestorChain from '@form-engine/core/utils/getAncestorChain'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import ThunkCacheManager from '@form-engine/core/compilation/thunks/ThunkCacheManager'
import { ValidationResult } from '@form-engine/core/nodes/expressions/validation/ValidationHandler'
import { BlockType } from '@form-engine/form/types/enums'
import {
  JourneyAncestor,
  RenderContext,
  NavigationTree,
  NavigationJourney,
  NavigationStep,
  JourneyMetadata,
  StepMetadata,
  Evaluated,
} from './types'

/**
 * Options for building render context
 */
export interface RenderContextOptions {
  /**
   * Whether to include validation errors in block data.
   * Set to true after form submission to display errors, false on initial GET.
   * Defaults to false.
   */
  showValidationFailures?: boolean

  /**
   * Raw navigation metadata from the router.
   * Will be hydrated with active state based on currentStepPath.
   */
  navigationMetadata?: JourneyMetadata[]

  /**
   * Full path of the current step (e.g., "/food-business/business-type").
   * Used to determine active state in navigation.
   */
  currentStepPath?: string
}

/**
 * Builds RenderContext from evaluated AST.
 *
 * RenderContextFactory is responsible for:
 * 1. Finding the current step in the evaluated journey by NodeId
 * 2. Collecting journey ancestors (root → immediate parent)
 * 3. Collecting all blocks (including nested) within the step
 * 4. Building the render context with all data needed for rendering
 *
 * The actual rendering of blocks to HTML (including filtering hidden blocks)
 * is handled by framework-specific renderers (e.g., TemplateRenderer).
 */
export default class RenderContextFactory {
  /**
   * Build render context for a step
   *
   * @param evaluationResult - Result from ThunkEvaluator.evaluate()
   * @param currentStepId - NodeId of the current step
   * @param options - Options (e.g., showValidationFailures, navigation)
   * @returns RenderContext with all data needed for rendering
   */
  static build(
    evaluationResult: EvaluationResult,
    currentStepId: NodeId,
    options: RenderContextOptions = {},
  ): RenderContext {
    const { cacheManager, metadataRegistry, nodeRegistry } = evaluationResult.context
    const showValidationFailures = options.showValidationFailures ?? false

    const step = RenderContextFactory.getStep(cacheManager, currentStepId)
    const ancestors = RenderContextFactory.getAncestors(cacheManager, metadataRegistry, currentStepId)

    const navigation = RenderContextFactory.buildNavigationTree(
      options.navigationMetadata ?? [],
      options.currentStepPath ?? '',
    )

    const validationErrors = showValidationFailures
      ? RenderContextFactory.collectValidationErrors(nodeRegistry, metadataRegistry, cacheManager)
      : []

    return {
      navigation,
      step: RenderContextFactory.toStepForRendering(step),
      ancestors: ancestors.map(RenderContextFactory.toJourneyAncestor),
      blocks: step.properties.blocks ?? [],
      showValidationFailures,
      validationErrors,
      answers: evaluationResult.context.global.answers,
      data: evaluationResult.context.global.data,
    }
  }

  /**
   * Convert evaluated step to step data for render context.
   * Excludes transitions (onLoad, onAction, onSubmission) and blocks.
   */
  private static toStepForRendering(step: Evaluated<StepASTNode>): RenderContext['step'] {
    const { onAction, onSubmission, blocks, ...stepProperties } = step.properties

    return stepProperties
  }

  /**
   * Get evaluated step from cache by NodeId.
   */
  private static getStep(cacheManager: ThunkCacheManager, stepId: NodeId): Evaluated<StepASTNode> {
    const result = cacheManager.get<Evaluated<StepASTNode>>(stepId)

    if (!result?.value) {
      throw new Error(`Step not found in cache: ${stepId}`)
    }

    return result.value
  }

  /**
   * Get journey ancestors from cache using metadata chain.
   * Returns ancestors in order from root to immediate parent.
   */
  private static getAncestors(
    cacheManager: ThunkCacheManager,
    metadataRegistry: MetadataRegistry,
    stepId: NodeId,
  ): JourneyASTNode[] {
    // Get ancestor chain: [rootId, ..., parentJourneyId, stepId]
    const chain = getAncestorChain(stepId, metadataRegistry)

    // Remove the step itself (last item)
    const ancestorIds = chain.slice(0, -1)

    // Get each ancestor from cache
    return ancestorIds.map(id => {
      const result = cacheManager.get<JourneyASTNode>(id)

      if (!result?.value) {
        throw new Error(`Ancestor not found in cache: ${id}`)
      }

      return result.value
    })
  }

  /**
   * Convert evaluated journey to JourneyAncestor for render context.
   * Excludes transitions (onLoad, onAccess), children, and steps.
   */
  private static toJourneyAncestor(journey: JourneyASTNode): JourneyAncestor {
    const { onAccess, children, steps, ...journeyProperties } = journey.properties

    return journeyProperties
  }

  /**
   * Build navigation tree with active state from stored metadata.
   * Hydrates raw metadata by adding type discriminators and computing active state.
   * Hidden items are preserved in the tree (with hiddenFromNavigation flag) for correct active state computation.
   */
  private static buildNavigationTree(metadata: JourneyMetadata[], currentStepPath: string): NavigationTree {
    return metadata.map(journey => RenderContextFactory.toNavigationJourney(journey, currentStepPath))
  }

  /**
   * Convert stored journey metadata to NavigationJourney with active state.
   * Hidden items are preserved with hiddenFromNavigation flag for template-level filtering.
   */
  private static toNavigationJourney(stored: JourneyMetadata, currentStepPath: string): NavigationJourney {
    const children = stored.children.map(child => {
      if ('children' in child) {
        return RenderContextFactory.toNavigationJourney(child, currentStepPath)
      }

      return RenderContextFactory.toNavigationStep(child, currentStepPath)
    })

    const hasActiveChild = children.some(child => child.active)

    return {
      type: 'journey',
      title: stored.title,
      description: stored.description,
      path: stored.path,
      active: hasActiveChild,
      hiddenFromNavigation: stored.hiddenFromNavigation,
      children,
    }
  }

  /**
   * Convert stored step metadata to NavigationStep with active state.
   */
  private static toNavigationStep(stored: StepMetadata, currentStepPath: string): NavigationStep {
    return {
      type: 'step',
      title: stored.title,
      path: stored.path,
      active: stored.path === currentStepPath,
      hiddenFromNavigation: stored.hiddenFromNavigation,
    }
  }

  /**
   * Collect failed validation results from all field blocks in the current step.
   */
  private static collectValidationErrors(
    nodeRegistry: NodeRegistry,
    metadataRegistry: MetadataRegistry,
    cacheManager: ThunkCacheManager,
  ): ValidationResult[] {
    return (
      nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
        .filter(block => metadataRegistry.get(block.id, 'isDescendantOfStep') === true)
        .flatMap(block => {
          const evaluated = cacheManager.get<Evaluated<FieldBlockASTNode>>(block.id)
          const validate = evaluated?.value?.properties?.validate
          const blockCode = evaluated?.value?.properties?.code as string | undefined

          if (!Array.isArray(validate)) {
            return []
          }

          return (validate as ValidationResult[])
            .filter(result => result.passed === false)
            .map(result => ({ ...result, blockCode }))
        })
    )
  }
}
