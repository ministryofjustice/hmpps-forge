import type { ASTNode, NodeId } from '../ast/ast.type'
import type { RedirectOutcomeASTNode } from '../ast/expressions.type'
import type { ReachabilityTieBreakerEntry } from './compilationPlan.type'
import type { UnreachableRedirectTarget } from '../../../authoring/types/structures.type'

export interface StepRuntimePlan {
  stepId: NodeId
  path: string
}

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
  forwardOutcomeEvaluation?: ForwardOutcomeEvaluation
}

export type ForwardOutcomeEvaluation = 'exact' | 'over-approximate'

export interface ReachabilityCompilationPlan {
  stateTable: ReachabilityStateTable
  entries: ReachabilityCompilationEntry[]
  resumeAlways: boolean
  resumeWhen?: ASTNode
}

export interface ReachabilityCompilationEntry extends ReachabilityStateTableEntry {
  entryWhen?: ASTNode
  forwardOutcomeGroups: ForwardOutcomeGroup[]
  cleardownFieldCodes: string[]
  reachabilityTieBreakers: ReachabilityTieBreakerEntry[]
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
  hookWhen?: ASTNode
  redirectOutcomes: ForwardRedirectOutcome[]
}

/**
 * A single redirect outcome within a group. `overApproximatesWhen` is true when
 * the outcome's own `when:` references request-time namespaces, so the compiler
 * records its goto unconditionally instead of gating the cascade on the guard.
 */
export interface ForwardRedirectOutcome {
  node: RedirectOutcomeASTNode
  overApproximatesWhen: boolean
}

export interface JourneyRuntimePlan {
  journeyId: NodeId
  path: string
}
