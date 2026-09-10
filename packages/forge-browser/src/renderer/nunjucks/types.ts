import { RenderBlock, RenderContext, RouteTreeRouteKind } from '@ministryofjustice/hmpps-forge/core/framework'
import type { Loader, PrecompiledLoader } from 'nunjucks'

/** Runtime properties omitted by the Nunjucks community typings. */
export interface PrecompiledTemplateLoader extends PrecompiledLoader {
  precompiled: Record<string, object>
}

/**
 * The template environment the renderer needs: nunjucks-shaped, but structural
 * so the consumer can supply a `nunjucks-slim` environment backed by
 * precompiled templates - the browser never compiles a template.
 */
export interface BrowserTemplateEnvironment {
  loaders?: Loader[]
  invalidateCache?(): void
  getTemplate(name: string): { render(context?: object): string }
  render(name: string, context?: object): string
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

/** Template context passed to page templates (RenderContext with blocks rendered to HTML) */
export type TemplateContext = Omit<RenderContext, 'blocks' | 'showValidationFailures'> & {
  blocks: readonly string[] | readonly TemplateBlock[]
  navigation: TemplateNavigationItem[]
  [key: string]: unknown
}
