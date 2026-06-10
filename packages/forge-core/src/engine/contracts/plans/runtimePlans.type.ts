import type { NodeId } from '../ast/ast.type'
import type {
  CompiledNavigationOutcomesFunction,
  CompiledNavigationPredicateFunction,
  CompiledNavigationTieBreakerFunction,
  CompiledStepFieldCodesFunction,
  CompiledValidationFunction,
} from '../compiled/compiledFunctions.type'
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

export interface JourneyRuntimePlan {
  journeyId: NodeId
  path: string
  staticData: Record<string, unknown>
}
