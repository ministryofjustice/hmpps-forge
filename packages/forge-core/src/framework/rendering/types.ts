import { NodeId } from '../../engine/contracts/ast/ast.type'
import { BlockType } from '../../authoring/types/enums'
import { ValidationResult } from '../../engine/contracts/runtime/validationResult.type'
import type { ViewConfig } from '../../authoring/types/structures.type'
import type { ComponentRegistryEntry } from '../../components/types/components.type'
import type { BlockDefinition, EvaluatedBlock } from '../../components/types/structures.type'

type MaybePromise<T> = T | Promise<T>

export interface RenderBlock {
  readonly id: NodeId
  readonly variant: string
  readonly blockType: BlockType
  readonly properties: Record<string, unknown>
}

export type RouteTreeRouteKind = 'journey' | 'step'

export interface RouteTreeRoute {
  kind: RouteTreeRouteKind
  nodeId: NodeId
  title?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface RouteTreeNode {
  segment: string
  path: string
  templatePath: string
  active: boolean
  metadata?: Record<string, unknown>
  route?: RouteTreeRoute
  children: RouteTreeNode[]
}

export type RouteTree = RouteTreeNode[]

/**
 * Journey ancestor in the render context.
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
  fieldValidationErrors: ValidationResult[]

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
  wrapNestedBlock(block: BlockDefinition, output: TOut): MaybePromise<unknown>
  assemblePage(
    context: RenderContext,
    renderedBlocks: readonly TOut[],
    requestState: Record<string, unknown>,
  ): MaybePromise<TOut>
}
