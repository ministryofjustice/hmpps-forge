export interface ReachabilityStep {
  path: string
  code?: string
  fieldCodes?: string[]
  cleardownFieldCodes?: string[]
  backPath?: string
}

export interface JourneyReachabilityState {
  reachableSteps: ReachabilityStep[]
  unreachableSteps: ReachabilityStep[]
}
