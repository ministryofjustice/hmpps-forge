export interface ValidationResult {
  passed: boolean
  message: string
  submissionOnly: boolean
  groups: string[]
  details?: Record<string, unknown>
  blockCode?: string
}
