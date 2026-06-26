export interface StepReachabilityProjection {
  path: string
  code?: string
  fieldCodes?: string[]
  cleardownFieldCodes?: string[]
  backPath?: string
}

export interface JourneyReachabilityState {
  reachableSteps: StepReachabilityProjection[]
  unreachableSteps: StepReachabilityProjection[]
}
