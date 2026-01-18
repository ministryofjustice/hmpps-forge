import { ASTNode } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ValidationResult } from '@form-engine/core/nodes/expressions/validation/ValidationHandler'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { ViewConfig } from '@form-engine/form/types/structures.type'

/**
 * Recursively evaluates AST node types.
 * - Structure nodes (Journey, Step, Block) keep their shape with evaluated properties
 * - Expression/Transition nodes resolve to `unknown` (their runtime value)
 * - Arrays recurse on elements
 * - Primitives pass through unchanged
 */
export type Evaluated<T> = T extends {
  type: ASTNodeType.JOURNEY | ASTNodeType.STEP | ASTNodeType.BLOCK
  properties: infer P
}
  ? Omit<T, 'properties'> & { properties: EvaluatedProperties<P> }
  : T extends ASTNode
    ? unknown
    : T extends (infer E)[]
      ? Evaluated<E>[]
      : T

type EvaluatedProperties<P> = {
  [K in keyof P]: Evaluated<P[K]>
}

/**
 * Step metadata (raw, without navigation state)
 */
export interface StepMetadata {
  title?: string
  path: string
  hiddenFromNavigation?: boolean
}

/**
 * Journey metadata (raw, without navigation state)
 */
export interface JourneyMetadata {
  title?: string
  description?: string
  path: string
  hiddenFromNavigation?: boolean
  children: (JourneyMetadata | StepMetadata)[]
}

/** Navigation step (hydrated with type discriminator + active state) */
export type NavigationStep = StepMetadata & { type: 'step'; active: boolean }

/** Navigation journey (hydrated with type discriminator + active state) */
export type NavigationJourney = Omit<JourneyMetadata, 'children'> & {
  type: 'journey'
  active: boolean
  children: (NavigationJourney | NavigationStep)[]
}

/**
 * Complete navigation tree for all registered forms
 */
export type NavigationTree = NavigationJourney[]

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
  /** Navigation tree for side menus, showing all journeys and steps with active state */
  navigation: NavigationTree

  /**
   * Current step properties (excluding transitions and blocks).
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
  blocks: Evaluated<BlockASTNode>[]

  /** Whether to show validation failures on blocks */
  showValidationFailures: boolean

  /** Failed validation results from field blocks (only populated when showValidationFailures is true) */
  validationErrors: ValidationResult[]

  /** Current answers state */
  answers: Record<string, unknown>

  /** Current data state */
  data: Record<string, unknown>
}
