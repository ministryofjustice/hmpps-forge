import type { JourneyDefinition } from '../../../authoring/types/structures.type'
import type { DSLPathSegment } from '../../diagnostics/sourceMetadata'

export interface AncestorNode {
  readonly type: string
  readonly record: Record<string, unknown>
}

export interface TraversalContext {
  readonly path: readonly DSLPathSegment[]
  readonly root: JourneyDefinition
  readonly ancestors: readonly AncestorNode[]
  readonly insideFieldCode: boolean
  readonly record: Record<string, unknown> | undefined
}

export interface ReferenceValidationRule {
  readonly kind: 'reference'
  readonly check: (referencePath: unknown[], context: TraversalContext) => readonly Error[]
}

export interface FunctionValidationRule {
  readonly kind: 'function'
  readonly check: (name: string, functionType: string, context: TraversalContext) => readonly Error[]
}

export interface BlockValidationRule {
  readonly kind: 'block'
  readonly check: (variant: string, context: TraversalContext) => readonly Error[]
}

export type ValidationRule = ReferenceValidationRule | FunctionValidationRule | BlockValidationRule
