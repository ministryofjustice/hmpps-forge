import { NodeId } from '../ast/ast.type'
import type { UnreachableRedirectTarget } from '../../../authoring/types/structures.type'

export type ResumeOutcome = 'no-op' | 'redirect'

export interface ReachabilityNode {
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
  tieBreakerPriority?: number
}

export interface ReachabilityEvaluation {
  currentStepId: NodeId | undefined
  steps: ReachabilityNode[]
  defaultEntryRouteTemplatePath: string | undefined
  frontierRouteTemplatePath: string | undefined
  canonicalPathRouteTemplatePaths: string[]
  progressExists: boolean
  resumeActive: boolean
  resumeOutcome: ResumeOutcome
  unreachableRedirect: UnreachableRedirectTarget
  /**
   * The current step's forward-edge route-template paths that answer-cleardown must
   * retain (empty when there is no current step, it is unreachable or invalid, or its
   * forward outcomes are over-approximated). Lets cleardown keep progress the user can
   * still return to without consulting the navigation plan.
   */
  cleardownRetentionRouteTemplatePaths: string[]
}
