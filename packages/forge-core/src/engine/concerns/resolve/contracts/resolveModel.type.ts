import type { IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { BlockASTNode } from '../../../chassis/contracts/ast/structures.type'
import type { TemplateNode } from '../../../chassis/contracts/ast/template.type'
import type { AuthoredValue } from '../../../chassis/contracts/models/authoredValue.type'

/**
 * The resolve concern's semantic model for one step. Built by
 * `ResolveAnalyzer`, consumed by `StepResolveCompiler`. AST nodes survive here
 * only as expression leaves and diagnostic tokens; render-facing property
 * selection (which authored props reach the render context) is decided at
 * analysis, so the compiler only materialises what it is handed.
 */
export interface ResolveModel {
  /** Script-URL identity segment; `undefined` leaves the script unlabelled. */
  readonly label?: string
  /** The step's render-facing properties, in authored order. */
  readonly step: readonly ResolvePropertyModel[]
  /** Ancestor journeys root-first, each with its render-facing properties. */
  readonly ancestors: readonly ResolveAncestorModel[]
  /** The step's own blocks, in authored order. */
  readonly blocks: readonly ResolveBlockModel[]
  /** MAP iterators that stand alone as block producers (not property values). */
  readonly standaloneIterateBlocks: readonly StandaloneIterateModel[]
}

export interface ResolvePropertyModel {
  readonly key: string
  readonly value: AuthoredValue
}

export interface ResolveAncestorModel {
  readonly properties: readonly ResolvePropertyModel[]
  /**
   * The ancestor's cumulative path, pre-composed at analysis when every path
   * segment up to this ancestor is static. Absent as soon as any segment is
   * dynamic — the generated code then composes the whole chain at request time.
   */
  readonly composedPath?: string
}

export interface ResolveBlockModel {
  /** The block node — diagnostics, and template instance-id emission. */
  readonly source: BlockASTNode | TemplateNode
  /** Registered block id; template blocks derive an instance id at runtime. */
  readonly id?: string
  readonly variant: string
  readonly blockType: string
  /** Generated-comment label: the authored path tail, else the block id. */
  readonly label: string
  /** Render-facing properties in authored order. */
  readonly properties: readonly ResolvePropertyModel[]
  /** Whether a FIELD block resolves its value from stored answers. */
  readonly resolvesFieldValue: boolean
}

/** One standalone MAP iterator and the template blocks it yields. */
export interface StandaloneIterateModel {
  readonly node: IterateASTNode
  readonly templateBlocks: readonly ResolveBlockModel[]
}
