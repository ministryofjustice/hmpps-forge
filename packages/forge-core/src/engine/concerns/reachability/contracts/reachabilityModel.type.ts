import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { RedirectOutcomeASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { UnreachableRedirectTarget } from '../../../../authoring/types/structures.type'

/**
 * The per-journey static data the compiled reachability state function reads: the
 * ordered step table plus the journey-level navigation flags. Pure data — the
 * compiled functions live on `CompiledStep` / `CompiledJourney`, and the state
 * closure captures this table privately.
 */
export interface ReachabilityStateTable {
  entries: ReachabilityStateTableEntry[]
  unreachableRedirect: UnreachableRedirectTarget
  reachabilityDisabled: boolean
}

export interface ReachabilityStateTableEntry {
  stepId: NodeId
  code?: string
  isEntryPoint: boolean
}

/**
 * The reachability concern's semantic model for one journey. Built by
 * `ReachabilityAnalyzer`, consumed by `ReachabilityCompiler` (facts) and, via
 * `stateTable`, the runtime state closure. AST nodes survive here only as
 * expression leaves and diagnostic tokens.
 */
export interface ReachabilityModel {
  /** Script-URL identity segment; `undefined` leaves the script unlabelled. */
  readonly label?: string
  /**
   * The journey's runtime step table. The model carries the single instance:
   * the compiled facts and the runtime state closure must read the same table.
   */
  readonly stateTable: ReachabilityStateTable
  readonly entries: readonly ReachabilityEntryModel[]
  readonly resumeAlways: boolean
  readonly resumeWhen?: ASTNode
}

export interface ReachabilityEntryModel extends ReachabilityStateTableEntry {
  readonly entryWhen?: ASTNode
  readonly forwardOutcomeGroups: readonly ForwardOutcomeGroup[]
  readonly cleardownFieldCodes: readonly string[]
  readonly reachabilityTieBreakers: readonly ReachabilityTieBreakerEntry[]
}

/**
 * Per-submit-hook grouping of forward outcomes. Each group corresponds to one
 * submit hook on the source step; the cascade short-circuit applies within a
 * group but never across groups.
 *
 * `hookWhen` is set only when the hook's `when:` is reachability-compilable
 * (does not reference request-time namespaces like post/params/query/request).
 * When set, the compiler wraps the group in `if (Boolean(whenExpr))`. When
 * unset, the group contributes its outcomes unguarded — an intentional
 * over-approximation for non-evaluable guards.
 */
export interface ForwardOutcomeGroup {
  readonly hookWhen?: ASTNode
  readonly redirectOutcomes: readonly ForwardRedirectOutcome[]
}

/**
 * A single redirect outcome within a group. `overApproximatesWhen` is true when
 * the outcome's own `when:` references request-time namespaces, so the compiler
 * records its goto unconditionally instead of gating the cascade on the guard.
 */
export interface ForwardRedirectOutcome {
  readonly node: RedirectOutcomeASTNode
  readonly overApproximatesWhen: boolean
}

export interface ReachabilityTieBreakerEntry {
  readonly priority: number
  readonly when?: ASTNode
}
