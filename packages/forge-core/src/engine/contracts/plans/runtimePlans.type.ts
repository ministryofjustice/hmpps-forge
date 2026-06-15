import type { NodeId } from '../ast/ast.type'
import type {
  CompiledNavigationOutcomesFunction,
  CompiledNavigationPredicateFunction,
  CompiledNavigationTieBreakerFunction,
  CompiledStepFieldCodesFunction,
} from '../compiled/compiledFunctions.type'
import type { ValidationPlan } from './compilationArtefacts.type'
import type { TemplateMaterialisationPlan } from './materialisationArtefacts.type'
import type { UnreachableRedirectTarget } from '../../../authoring/types/structures.type'

export interface RuntimePlan {
  readonly nodeId: NodeId
  readonly path: string
  readonly staticData: Record<string, unknown>
}

export interface NavigationRuntimePlan {
  readonly navigationSteps: readonly CompiledNavigationStep[]
  readonly resumeConfigured: boolean
  /** True when the journey resumes unconditionally (`resumeWhen: true`). */
  readonly resumeAlways: boolean
  /** Evaluates the journey's `resumeWhen` predicate; absent when resume is static. */
  readonly evaluateResumeWhen?: CompiledNavigationPredicateFunction
  readonly unreachableRedirect: UnreachableRedirectTarget
  readonly reachabilityDisabled: boolean
}

export interface CompiledNavigationStep {
  readonly nodeId: NodeId
  readonly code?: string
  readonly isEntryPoint: boolean
  /** Validation the reachability walk evaluates to decide step validity; empty when the step declares none. */
  readonly validationPlan: ValidationPlan
  /** Materialisation plan the reachability walk runs per step before validating iterator fields. */
  readonly materialisationPlan: TemplateMaterialisationPlan
  /** Field codes cleared down when the step becomes unreachable. */
  readonly cleardownFieldCodes: readonly string[]
  /** Statically-declared forward gotos across all hooks, regardless of guards (devtools-only). */
  readonly declaredOutcomes: readonly string[]
  /** Evaluates the step's `entryWhen` predicate (absent = no predicate). */
  readonly evaluateEntryWhen?: CompiledNavigationPredicateFunction
  /** Evaluates the step's forward outcome gotos (absent = no redirect outcomes). */
  readonly evaluateOutcomes?: CompiledNavigationOutcomesFunction
  /** Resolves the step's tie-breaker priority (absent = no tie-breakers). */
  readonly evaluateTieBreaker?: CompiledNavigationTieBreakerFunction
  /** Collects the step's possible field codes (absent = no fields). */
  readonly evaluateFieldCodes?: CompiledStepFieldCodesFunction
}
