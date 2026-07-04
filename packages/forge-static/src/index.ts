/**
 * forge-static
 *
 * Static site generator for Forge. Walks a compiled journey's topology,
 * executes each step with blank state, and writes the rendered HTML to disk.
 *
 * Rendering is driven by a `ForgeRenderer<string>`. The bundled
 * {@link StaticHtmlRenderer} produces build-time HTML; omit it for a plain
 * default page shell, or pass a custom `page` function for your own layout.
 *
 * @example
 * ```typescript
 * import { Forge } from '@ministryofjustice/hmpps-forge/core'
 * import { StaticSiteGenerator, StaticHtmlRenderer } from '@ministryofjustice/hmpps-forge/static'
 *
 * const forge = new Forge({ logger: console })
 *   .registerGlobalComponents(myComponents)
 *   .registerPackage(myContentPackage)
 *
 * const generator = new StaticSiteGenerator({
 *   forge,
 *   outputDir: './dist',
 *   renderer: new StaticHtmlRenderer({
 *     page: ({ context, blocks, basePath }) => myLayout(context, blocks, basePath),
 *   }),
 * })
 *
 * const result = await generator.build()
 * console.log(`Generated ${result.pages.length} pages`)
 * ```
 */

export { StaticSiteGenerator } from './StaticSiteGenerator'
export { StaticHtmlRenderer, FORGE_STATIC_BASE_PATH } from './StaticHtmlRenderer'
export type { StaticHtmlRendererOptions, StaticPageRenderer, StaticPageRenderContext } from './StaticHtmlRenderer'
export { bundleAssets } from './bundleAssets'
export type { BundleAssetsOptions, BundleAssetsResult } from './bundleAssets'
export type { AssetSource, GeneratedPage, SkippedRoute, StaticBuildResult, StaticSiteOptions } from './types'
