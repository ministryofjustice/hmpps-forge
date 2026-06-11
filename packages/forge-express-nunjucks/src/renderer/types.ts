import { RenderContext, RouteTreeRouteKind } from '@ministryofjustice/hmpps-forge/core/framework'

export interface TemplateNavigationItem {
  type: RouteTreeRouteKind
  title?: string
  description?: string
  path: string
  active: boolean
  metadata?: Record<string, unknown>
  children: TemplateNavigationItem[]
}

/** Template context passed to Nunjucks page templates (RenderContext with blocks rendered to HTML) */
export type TemplateContext = Omit<RenderContext, 'blocks' | 'showValidationFailures'> & {
  blocks: string[]
  navigation: TemplateNavigationItem[]
  [key: string]: unknown
}
