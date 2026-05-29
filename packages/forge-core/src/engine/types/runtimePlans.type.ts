import type { NodeId } from './ast.type'
import type { CompiledAccessLifecycleFunction, CompiledSubmitHooksFunction } from './hookLifecycle.type'
import type { CompiledAnswerPreparationFunction, CompiledValidationFunction } from './compiledPhaseResults.type'
import type { CompiledNavigationFunction } from '../compilation/codegen/phase-compilers/reachability/ReachabilityCompiler'
import type { ReachabilityTieBreakerEntry } from './compilationPlan.type'
import type { UnreachableRedirectTarget } from '../../authoring/types/structures.type'

export interface StepRuntimePlan {
  stepId: NodeId
  path: string
  staticData: Record<string, unknown>
  compiledAccessLifecycle?: CompiledAccessLifecycleFunction
  compiledSubmitHooks?: CompiledSubmitHooksFunction
}

export interface NavigationRuntimePlan {
  entries: NavigationRuntimeEntry[]
  resumeConfigured: boolean
  unreachableRedirect: UnreachableRedirectTarget
  reachabilityDisabled: boolean
  compiledNavigation?: CompiledNavigationFunction
  compiledStepValidations: Map<NodeId, CompiledValidationFunction>
}

export interface NavigationRuntimeEntry {
  stepId: NodeId
  code?: string
  isEntryPoint: boolean
  hasValidation: boolean
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
  outcomeIds: NodeId[]
}

export interface JourneyRuntimePlan {
  path: string
  staticData: Record<string, unknown>
  navigationPlan: NavigationRuntimePlan
  compiledAnswerPreparation?: CompiledAnswerPreparationFunction
  compiledAccessLifecycle?: CompiledAccessLifecycleFunction
}
