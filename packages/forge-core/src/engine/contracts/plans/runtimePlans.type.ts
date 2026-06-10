import type { NodeId } from '../ast/ast.type'
import type {
  CompiledNavigationOutcomesFunction,
  CompiledNavigationPredicateFunction,
  CompiledNavigationTieBreakerFunction,
  CompiledStepFieldCodesFunction,
  CompiledValidationFunction,
} from '../compiled/compiledFunctions.type'
import type { ReachabilityTieBreakerEntry } from './compilationPlan.type'
import type { UnreachableRedirectTarget } from '../../../authoring/types/structures.type'

export interface StepRuntimePlan {
  stepId: NodeId
  path: string
  staticData: Record<string, unknown>
}

export interface NavigationRuntimePlan {
  entries: NavigationRuntimeEntry[]
  resumeConfigured: boolean
  /** True when the journey resumes unconditionally (`resumeWhen: true`). */
  resumeAlways: boolean
  /** Evaluates the journey's `resumeWhen` predicate; absent when resume is static. */
  evaluateResume?: CompiledNavigationPredicateFunction
  unreachableRedirect: UnreachableRedirectTarget
  reachabilityDisabled: boolean
  compiledStepValidations: Map<NodeId, CompiledValidationFunction>
}

export interface NavigationRuntimeEntry {
  stepId: NodeId
  code?: string
  isEntryPoint: boolean
  hasValidation: boolean
  /** Field codes cleared down when the step becomes unreachable. */
  cleardownFieldCodes: string[]
  /** Statically-declared forward gotos across all hooks, regardless of guards (devtools-only). */
  declaredOutcomes: string[]
  /** Evaluates the step's conditional-entry predicate (absent = no predicate). */
  evaluateEntry?: CompiledNavigationPredicateFunction
  /** Evaluates the step's forward outcome gotos (absent = no redirect outcomes). */
  evaluateOutcomes?: CompiledNavigationOutcomesFunction
  /** Resolves the step's tie-breaker priority (absent = no tie-breakers). */
  evaluateTieBreaker?: CompiledNavigationTieBreakerFunction
  /** Collects the step's possible field codes (absent = no fields). */
  evaluateFieldCodes?: CompiledStepFieldCodesFunction
}

export interface ReachabilityCompilationPlan {
  navigationPlan: NavigationRuntimePlan
  entries: ReachabilityCompilationEntry[]
  resumeAlways: boolean
  resumeWhenNodeId?: NodeId
}

export interface ReachabilityCompilationEntry extends NavigationRuntimeEntry {
  entryWhenNodeId?: NodeId
  forwardOutcomeGroups: ForwardOutcomeGroup[]
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
  outcomeIds: NodeId[]
}

export interface JourneyRuntimePlan {
  journeyId: NodeId
  path: string
  staticData: Record<string, unknown>
}
