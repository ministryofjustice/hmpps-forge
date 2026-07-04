import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeRenderer, ForgeRoute, Logger } from '@ministryofjustice/hmpps-forge/core/framework'

export interface AssetSource {
  from: string
  to: string
}

export interface StaticSiteOptions {
  forge: Forge
  outputDir: string
  /** Renderer driving the page HTML. Defaults to a plain {@link StaticHtmlRenderer}. */
  renderer?: ForgeRenderer<string>
  /** Assets copied recursively into the output directory after the pages are built. */
  assets?: AssetSource[]
  /** Only used to build the snapshot's location href - nothing is fetched from it. */
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
