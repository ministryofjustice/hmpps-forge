import { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { UnreachableRedirectTarget } from '../../../../authoring/types/structures.type'

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
}
