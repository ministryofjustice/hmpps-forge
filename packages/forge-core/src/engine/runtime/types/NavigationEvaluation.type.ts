import { NodeId } from '../../types/ast.type'

export interface NavigationStepState {
  stepId: NodeId
  routeTemplatePath: string
  code?: string
  isEntryPoint: boolean
  isConditionalEntry: boolean
  isReachable: boolean
  isValid: boolean
  forwardRouteTemplatePaths: string[]
  predecessorRouteTemplatePaths: string[]
  tieBreakerPriority?: number
}

export interface NavigationEvaluation {
  currentStepId: NodeId | undefined
  steps: NavigationStepState[]
  redirectTargetRouteTemplatePath: string | undefined
  resumeActive: boolean
}
