import { RenderContext } from '@form-engine/core/runtime/rendering/types'

/** Error format expected by components for displaying validation errors */
export interface FieldError {
  message: string
  details?: Record<string, unknown>
}

/** Validation error with field information for error summary (matches govukErrorSummary format) */
export interface ValidationError {
  text: string
  href: string
}

/** Template context passed to Nunjucks page templates (RenderContext with blocks rendered to HTML) */
export type TemplateContext = Omit<RenderContext, 'blocks' | 'showValidationFailures'> & {
  blocks: string[]
  validationErrors: ValidationError[]
  [key: string]: unknown
}
