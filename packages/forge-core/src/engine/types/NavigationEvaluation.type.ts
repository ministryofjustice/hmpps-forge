import { NodeId } from './ast.type'

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
  predecessorRouteTemplatePaths: string[]
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
}
