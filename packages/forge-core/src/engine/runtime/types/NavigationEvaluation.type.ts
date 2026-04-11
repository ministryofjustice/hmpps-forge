import { NodeId } from '../../types/ast.type'

export interface NavigationStepState {
  stepId: NodeId
  routeTemplatePath: string
  code?: string
  isEntryPoint: boolean
  isReachable: boolean
  isValid: boolean
  forwardRouteTemplatePaths: string[]
  predecessorRouteTemplatePaths: string[]
}

export interface NavigationEvaluation {
  currentStepId: NodeId
  steps: NavigationStepState[]
}
