import { NodeId } from '../../engine/types/ast.type'
import { ASTNodeType } from '../../engine/types/enums'
import { BlockType } from '../../authoring/types/enums'
import { ValidationResult } from '../../engine/runtime/types/ValidationResult.type'
import type { ViewConfig } from '../../authoring/types/structures.type'

export interface RenderBlock {
  readonly id: NodeId
  readonly type: ASTNodeType.BLOCK
  readonly variant: string
  readonly blockType: BlockType
  readonly properties: Record<string, unknown>
}

export function isRenderBlock(obj: unknown): obj is RenderBlock {
  return obj != null && typeof obj === 'object' && 'type' in obj && obj.type === ASTNodeType.BLOCK
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
 * Render context built by RenderContextFactory.
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

  /** Lookup to check if a block has nested blocks in its properties (used to skip unnecessary property walks) */
  hasNestedBlocks?: HasNestedBlocksLookup
}

export type HasNestedBlocksLookup = (blockId: NodeId) => boolean
