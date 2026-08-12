export interface StepReachabilityProjection {
  path: string
  code?: string
  fieldCodes?: string[]
  cleardownFieldCodes?: string[]
  backPath?: string
}

export interface JourneyReachabilityProjection {
  reachableSteps: StepReachabilityProjection[]
  unreachableSteps: StepReachabilityProjection[]
}
