import { NodeId } from '@form-engine/core/types/engine.type'
import { EvaluationResult } from '@form-engine/core/ast/thunks/ThunkEvaluator'
import { isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { structuralTraverse, StructuralVisitResult } from '@form-engine/core/ast/traverser/StructuralTraverser'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
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
 * Result of finding a step with its context
 */
interface StepSearchResult {
  step: Evaluated<StepASTNode>
  ancestors: JourneyASTNode[]
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
    const journeyValue = evaluationResult.journey.value

    const { step, ancestors } = RenderContextFactory.findStepWithContext(journeyValue, currentStepId)

    const navigation = RenderContextFactory.buildNavigationTree(
      options.navigationMetadata ?? [],
      options.currentStepPath ?? '',
    )

    return {
      navigation,
      step: RenderContextFactory.toStepForRendering(step),
      ancestors: ancestors.map(RenderContextFactory.toJourneyAncestor),
      blocks: step.properties.blocks ?? [],
      showValidationFailures: options.showValidationFailures ?? false,
      answers: evaluationResult.context.global.answers,
      data: evaluationResult.context.global.data,
    }
  }

  /**
   * Convert evaluated step to step data for render context.
   * Excludes transitions (onLoad, onAction, onSubmission) and blocks.
   */
  private static toStepForRendering(step: Evaluated<StepASTNode>): RenderContext['step'] {
    const { onLoad, onAction, onSubmission, blocks, ...stepProperties } = step.properties

    return stepProperties
  }

  /**
   * Find a step by NodeId and collect journey ancestors.
   * Uses structuralTraverse which tracks ancestors automatically.
   */
  private static findStepWithContext(value: unknown, stepId: NodeId): StepSearchResult {
    let step: StepASTNode
    let ancestors: JourneyASTNode[] = []

    structuralTraverse(value, {
      enterNode(node, ctx) {
        if (isStepStructNode(node) && node.id === stepId) {
          step = node
          ancestors = ctx.ancestors.filter(isJourneyStructNode)

          return StructuralVisitResult.STOP
        }

        return StructuralVisitResult.CONTINUE
      },
    })

    return {
      step,
      ancestors,
    }
  }

  /**
   * Convert evaluated journey to JourneyAncestor for render context.
   * Excludes transitions (onLoad, onAccess), children, and steps.
   */
  private static toJourneyAncestor(journey: JourneyASTNode): JourneyAncestor {
    const { onLoad, onAccess, children, steps, ...journeyProperties } = journey.properties

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
}
