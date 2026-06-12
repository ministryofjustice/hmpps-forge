import { NodeId } from '../../engine/contracts/ast/ast.type'
import { BlockType } from '../../authoring/types/enums'
import { ValidationResult } from '../../engine/contracts/runtime/validationResult.type'
import type { ViewConfig } from '../../authoring/types/structures.type'
import type { ComponentRegistryEntry } from '../../components/types/components.type'
import type { BlockDefinition, EvaluatedBlock } from '../../components/types/structures.type'

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

}

/**
 * The pluggable rendering backend, bound at orchestrator construction
 * (`new ForgeOrchestrator(forge, renderer)`). The orchestrator owns the block
 * walk — visibility, nesting, validation attachment, registry resolution,
 * per-block tracing — and drives the renderer with one call per block; the
 * renderer owns only host-specific output production (HTML strings, React nodes).
 */
export interface ForgeRenderer<TOut> {
  /**
   * Render one block. The orchestrator has already resolved the registry entry,
   * rendered nested blocks into the properties, and attached validation errors.
   * The renderer guards its own output type.
   */
  renderBlock(entry: ComponentRegistryEntry<BlockDefinition, TOut>, block: EvaluatedBlock<BlockDefinition>): TOut

  /** Wrap a rendered child for embedding in its parent block's properties. */
  wrapNestedBlock(block: BlockDefinition, output: TOut): unknown

  /**
   * Assemble the final page from the render context, the top-level block
   * outputs, and the adapter-supplied request state (e.g. template locals).
   */
  assemblePage(context: RenderContext, renderedBlocks: readonly TOut[], requestState: Record<string, unknown>): TOut
}
