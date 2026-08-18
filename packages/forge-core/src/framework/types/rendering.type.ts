import { NodeId } from '../../engine/chassis/contracts/ast/ast.type'
import { BlockType } from '../../authoring/types/enums'
import { ValidationResult } from '../../engine/concerns/validation/contracts/validationResult.type'
import type { ViewConfig } from '../../authoring/types/structures.type'
import type { ComponentRegistryEntry } from '../../components/types/components.type'
import type { BlockDefinition, EvaluatedBlock } from '../../components/types/structures.type'
import type { RouteTree } from './routeTree.type'

type MaybePromise<T> = T | Promise<T>

export interface RenderBlock {
  readonly id: NodeId
  readonly variant: string
  readonly blockType: BlockType
  readonly properties: Record<string, unknown>
}

/**
 * A field validation failure prepared for rendering. `anchor` is the failing
 * block instance's document anchor (its `idPrefix` or code) for error summary
 * links; several blocks may share one code, so the code alone cannot identify
 * the instance.
 */
export interface RenderValidationError extends ValidationResult {
  anchor?: string
}

/**
 * Journey ancestor in the render context, including its evaluated view configuration.
 */
export interface JourneyAncestor {
  code: string
  path: string
  title?: string
  view?: ViewConfig
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Render context assembled by the resolve phase (`request.resolve`).
 * Contains all data needed to render a page
 */
export interface RenderContext {
  /** Route hierarchy with request params resolved and active state applied. */
  routeTree: RouteTree

  /**
   * Current step properties (excluding hooks and blocks).
   * Contains all step properties like path, title, view, backlink, metadata,
   * plus any custom properties defined on the step.
   */
  step: {
    path: string
    title?: string
    /** Effective view inherited from journey ancestors and completed by the current step. */
    view?: ViewConfig
    backlink?: string
    metadata?: Record<string, unknown>
    [key: string]: unknown
  }

  /** Journey ancestors from root to immediate parent. */
  ancestors: JourneyAncestor[]

  /** Evaluated blocks ready for rendering (data, not HTML) */
  blocks: RenderBlock[]

  /** Whether to show validation failures on blocks */
  showValidationFailures: boolean

  /** Failed validation results from field blocks (only populated when showValidationFailures is true) */
  fieldValidationErrors: RenderValidationError[]

  /** Failed domain validation results from step-level validations (only populated when showValidationFailures is true) */
  domainValidationErrors: ValidationResult[]

  /** Current answers state */
  answers: Record<string, unknown>

  /** Current data state */
  data: Record<string, unknown>
}

export interface ForgeRenderer<TOut> {
  renderBlock(
    entry: ComponentRegistryEntry<BlockDefinition, TOut>,
    block: EvaluatedBlock<BlockDefinition>,
  ): MaybePromise<TOut>

  /**
   * Optionally tag a block's rendered output with an out-of-band marker tying it
   * to its `nodeId`, so devtools can locate the block within the host output —
   * for an HTML renderer, paired comments bracketing the block. The orchestrator
   * calls this once per rendered block (nested blocks included) and only while a
   * request is being traced, so untraced (production) output is never marked.
   * Renderers whose output can't carry an invisible marker omit this method.
   */
  markBlock?(nodeId: NodeId, output: TOut): TOut

  wrapNestedBlock(block: BlockDefinition, output: TOut): MaybePromise<unknown>
  assemblePage(
    context: RenderContext,
    renderedBlocks: readonly TOut[],
    requestState: Record<string, unknown>,
  ): MaybePromise<TOut>
}
