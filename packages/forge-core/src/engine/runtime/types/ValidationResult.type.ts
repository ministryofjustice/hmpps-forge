export interface ValidationResult {
  passed: boolean
  message: string
  submissionOnly: boolean
  details?: Record<string, unknown>
  blockCode?: string
}
