import { NodeId } from '../../types/ast.type'

export interface NavigationStepState {
  stepId: NodeId
  path: string
  code?: string
  isEntryPoint: boolean
  isReachable: boolean
  isValid: boolean
  forwardPath?: string
  predecessorPaths: string[]
}

export interface NavigationEvaluation {
  currentStepId: NodeId
  steps: NavigationStepState[]
}
