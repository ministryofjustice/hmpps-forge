import { NodeId } from '../ast/ast.type'
import type { UnreachableRedirectTarget } from '../../../authoring/types/structures.type'
import type { DomainValidationFailure, StepValidationFailure } from '../runtime/evaluationState.type'
import type { JourneyReachabilityState } from './journeyReachabilityState.type'
import type { JourneyRouteTemplateCatalog } from '../routing/routeTree.type'

export type ResumeOutcome = 'no-op' | 'redirect'

export interface NavigationStepState {
  stepId: NodeId
  routeTemplatePath: string
  code?: string
  declarationIndex: number
  isEntryPoint: boolean
  isConditionalEntry: boolean
  hasValidation: boolean
  isReachable: boolean
  isValid: boolean
  forwardRouteTemplatePaths: string[]
  declaredForwardRouteTemplatePaths?: string[]
  predecessorRouteTemplatePaths: string[]
  fieldFailures?: StepValidationFailure[]
  domainFailures?: DomainValidationFailure[]
  tieBreakerPriority?: number
}

export interface NavigationEvaluation {
  currentStepId: NodeId | undefined
  steps: NavigationStepState[]
  defaultEntryRouteTemplatePath: string | undefined
  frontierRouteTemplatePath: string | undefined
  canonicalPathRouteTemplatePaths: string[]
  progressExists: boolean
  resumeActive: boolean
  resumeOutcome: ResumeOutcome
  unreachableRedirect: UnreachableRedirectTarget
}

/**
 * Which redirect policy a navigation evaluation applies, named after the
 * pipeline position evaluating it: a step GET honours resume then falls back
 * to the unreachable redirect, a step POST only redirects away from an
 * unreachable step, and a journey root always picks an entry target.
 */
export type NavigationRedirectRule = 'step-get' | 'step-post' | 'journey-root'

/** The request-specific inputs to one navigation evaluation. */
export interface NavigationEvaluationInput {
  currentStepId?: NodeId
  routeTemplateCatalog: JourneyRouteTemplateCatalog
  params?: Record<string, string>
  redirectRule: NavigationRedirectRule
}

/**
 * One navigation evaluation's conclusion: the full per-step evaluation, the
 * projected reachability state (present when `params` were supplied), and the
 * redirect target the caller's resolver chose — absent when navigation lets
 * the request continue.
 */
export interface NavigationEvaluationResult {
  evaluation: NavigationEvaluation
  reachability?: JourneyReachabilityState
  redirectTarget?: string
}
