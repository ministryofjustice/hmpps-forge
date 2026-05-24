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
  forwardOutcomeIds: NodeId[]
  cleardownFieldCodes: string[]
  reachabilityTieBreakers: ReachabilityTieBreakerEntry[]
}

export interface JourneyRuntimePlan {
  path: string
  staticData: Record<string, unknown>
  navigationPlan: NavigationRuntimePlan
  compiledAnswerPreparation?: CompiledAnswerPreparationFunction
  compiledAccessLifecycle?: CompiledAccessLifecycleFunction
}
