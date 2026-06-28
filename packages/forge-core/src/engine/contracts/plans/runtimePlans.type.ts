import type { NodeId } from '../ast/ast.type'
import type {
  CompiledReachabilityFactsFunction,
  CompiledReachabilityStateFunction,
} from '../compiled/compiledFunctions.type'
import type { ReachabilityTieBreakerEntry } from './compilationPlan.type'
import type { UnreachableRedirectTarget } from '../../../authoring/types/structures.type'

export interface StepRuntimePlan {
  stepId: NodeId
  path: string
}

export interface NavigationRuntimePlan {
  entries: NavigationRuntimeEntry[]
  resumeConfigured: boolean
  unreachableRedirect: UnreachableRedirectTarget
  reachabilityDisabled: boolean
  compiledReachabilityFacts?: CompiledReachabilityFactsFunction
  compiledReachabilityState?: CompiledReachabilityStateFunction
}

export interface NavigationRuntimeEntry {
  stepId: NodeId
  code?: string
  isEntryPoint: boolean
  /**
   * Whether the step has real validation (validating field blocks or domain
   * validWhen). The eager validities phase validates only these steps, so the
   * navigation walk treats a step absent from the validity map as valid.
   */
  hasValidation?: boolean
  forwardOutcomeEvaluation?: ForwardOutcomeEvaluation
}

export type ForwardOutcomeEvaluation = 'exact' | 'over-approximate'

export interface ReachabilityCompilationPlan {
  navigationPlan: NavigationRuntimePlan
  entries: ReachabilityCompilationEntry[]
  resumeAlways: boolean
  resumeWhenNodeId?: NodeId
}

export interface ReachabilityCompilationEntry extends NavigationRuntimeEntry {
  entryWhenNodeId?: NodeId
  forwardOutcomeGroups: ForwardOutcomeGroup[]
  cleardownFieldCodes: string[]
  reachabilityTieBreakers: ReachabilityTieBreakerEntry[]
}

/**
 * Per-submit-hook grouping of forward outcomes. Each group corresponds to one
 * submit hook on the source step; the cascade short-circuit applies within a
 * group but never across groups.
 *
 * `hookWhenNodeId` is set only when the hook's `when:` is reachability-compilable
 * (does not reference request-time namespaces like post/params/query/request).
 * When set, the compiler wraps the group in `if (Boolean(whenExpr))`. When
 * unset, the group contributes its outcomes unguarded — an intentional
 * over-approximation for non-evaluable guards.
 */
export interface ForwardOutcomeGroup {
  hookWhenNodeId?: NodeId
  overApproximateOutcomeIds?: NodeId[]
  outcomeIds: NodeId[]
}

export interface JourneyRuntimePlan {
  journeyId: NodeId
  path: string
}
