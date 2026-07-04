import type {
  BlockDefinition,
  EvaluatedBlock,
  RenderedBlock,
  ComponentRegistryEntry,
} from '@ministryofjustice/hmpps-forge/core/components'
import type { ForgeRenderer, RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'

/**
 * Snapshot-state key carrying the per-page relative asset prefix (e.g. `'../..'`)
 * into {@link StaticHtmlRenderer.assemblePage}. This is the static generator's
 * equivalent of a per-request channel: the generator writes it into the
 * snapshot's `state` for each page, and `assemblePage` reads it back to build
 * asset URLs relative to the page's depth in the output tree.
 */
export const FORGE_STATIC_BASE_PATH = 'forgeStaticBasePath'

export interface StaticPageRenderContext {
  context: RenderContext
  blocks: readonly string[]
  basePath: string
}

export type StaticPageRenderer = (page: StaticPageRenderContext) => string

export interface StaticHtmlRendererOptions {
  page?: StaticPageRenderer
  rendererContext?: unknown
}

export class StaticHtmlRenderer implements ForgeRenderer<string> {
  private readonly page: StaticPageRenderer

  private readonly rendererContext: unknown

  constructor(options: StaticHtmlRendererOptions = {}) {
    this.page = options.page ?? renderDefaultPage
    this.rendererContext = options.rendererContext
  }

  renderBlock(entry: ComponentRegistryEntry<BlockDefinition, string>, block: EvaluatedBlock<BlockDefinition>): string {
    const rendered = entry.render(block, this.rendererContext)

    if (typeof rendered !== 'string') {
      throw new Error(`Component variant "${block.variant}" must render an HTML string for the static site generator.`)
    }

    return rendered
  }

  wrapNestedBlock(block: BlockDefinition, output: string): RenderedBlock {
    return { block, html: output }
  }

  assemblePage(
    context: RenderContext,
    renderedBlocks: readonly string[],
    requestState: Record<string, unknown>,
  ): string {
    const rawBasePath = requestState[FORGE_STATIC_BASE_PATH]
    const basePath = typeof rawBasePath === 'string' ? rawBasePath : '.'

    return this.page({ context, blocks: renderedBlocks, basePath })
  }
}

function renderDefaultPage({ context, blocks }: StaticPageRenderContext): string {
  const title = context.step.title ?? 'Forge'

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    `  <title>${title}</title>`,
    '</head>',
    '<body>',
    `  <main><h1>${title}</h1>${blocks.join('\n')}</main>`,
    '</body>',
    '</html>',
  ].join('\n')
}
