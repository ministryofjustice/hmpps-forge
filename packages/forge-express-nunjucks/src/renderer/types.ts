import { RenderBlock, RenderContext, RouteTreeRouteKind } from '@ministryofjustice/hmpps-forge/core/framework'

/** Error format expected by components for displaying validation errors */
export interface FieldError {
  message: string
  details?: Record<string, unknown>
}

export interface TemplateNavigationItem {
  type: RouteTreeRouteKind
  title?: string
  description?: string
  path: string
  active: boolean
  metadata?: Record<string, unknown>
  children: TemplateNavigationItem[]
}

/** Page-level block entry passed to templates when the renderer is configured with `includeBlockData: true` */
export interface TemplateBlock {
  html: string
  block: RenderBlock
}

/** Template context passed to Nunjucks page templates (RenderContext with blocks rendered to HTML) */
export type TemplateContext = Omit<RenderContext, 'blocks' | 'showValidationFailures'> & {
  blocks: readonly string[] | readonly TemplateBlock[]
  navigation: TemplateNavigationItem[]
  [key: string]: unknown
}
