import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type {
  ComponentRegistry,
  ForgeRoute,
  Logger,
  RenderContext,
} from '@ministryofjustice/hmpps-forge/core/framework'

export interface StaticRenderContext {
  basePath: string
}

export type StaticRenderFunction = (
  context: RenderContext,
  componentRegistry: ComponentRegistry,
  staticContext: StaticRenderContext,
) => string | Promise<string>

export interface AssetSource {
  from: string
  to: string
}

export interface StaticSiteOptions {
  forge: Forge
  outputDir: string
  render: StaticRenderFunction
  assets?: AssetSource[]
  origin?: string
  logger?: Logger | Console
}

export interface GeneratedPage {
  route: ForgeRoute
  relativePath: string
  outputPath: string
}

export interface SkippedRoute {
  route: ForgeRoute
  reason: string
}

export interface StaticBuildResult {
  pages: GeneratedPage[]
  skipped: SkippedRoute[]
}
