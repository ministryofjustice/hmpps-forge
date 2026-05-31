/**
 * forge-static
 *
 * Static site generator for Forge. Walks a compiled journey's topology,
 * evaluates each step with blank state, and writes the rendered HTML to disk.
 *
 * The render function is provided by the caller — use the Nunjucks
 * TemplateRenderer from forge-express-nunjucks, or bring your own.
 *
 * @example
 * ```typescript
 * import { Forge } from '@ministryofjustice/hmpps-forge/core'
 * import { StaticSiteGenerator } from '@ministryofjustice/hmpps-forge/static'
 *
 * const forge = new Forge({ logger: console })
 *   .registerGlobalComponents(myComponents)
 *   .registerPackage(myContentPackage)
 *
 * const generator = new StaticSiteGenerator({
 *   forge,
 *   outputDir: './dist',
 *   render: (context, componentRegistry) => myRenderer.render(context, componentRegistry),
 * })
 *
 * const result = await generator.build()
 * console.log(`Generated ${result.pages.length} pages`)
 * ```
 */

export { StaticSiteGenerator } from './StaticSiteGenerator'
export { bundleAssets } from './bundleAssets'
export type { BundleAssetsOptions, BundleAssetsResult } from './bundleAssets'
export type { AssetSource, GeneratedPage, SkippedRoute, StaticBuildResult, StaticRenderContext, StaticRenderFunction, StaticSiteOptions } from './types'
