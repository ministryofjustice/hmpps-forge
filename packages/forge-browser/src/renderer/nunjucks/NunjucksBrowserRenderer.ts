import type { BlockDefinition, RenderedBlock } from '@ministryofjustice/hmpps-forge/core/components'
import type { NodeId, RenderContext, RouteTreeNode } from '@ministryofjustice/hmpps-forge/core/framework'
import nunjucks from 'nunjucks'
import NunjucksPrecompiledLoader from './NunjucksPrecompiledLoader'
import type { BrowserRenderingEngine } from '../BrowserRenderingEngine.type'
import type {
  BrowserTemplateEnvironment,
  PrecompiledTemplateLoader,
  TemplateBlock,
  TemplateContext,
  TemplateNavigationItem,
} from './types'

export interface NunjucksBrowserRendererOptions {
  /**
   * Nunjucks environment shared by page and component rendering. The renderer
   * configures relative loading for precompiled templates and contributes the
   * environment to the browser adapter's dependencies.
   */
  templateEnv: BrowserTemplateEnvironment

  /**
   * Template used when neither the step nor its journey ancestors resolve a
   * `view.template`. The `.njk` extension is appended automatically when not
   * present.
   *
   * @default 'form-step'
   */
  defaultTemplate?: string

  /**
   * When true, the `blocks` array handed to page templates carries `{ html, block }`
   * entries pairing each rendered string with its `RenderBlock` data (id, variant,
   * block type, and evaluated properties including any authored `metadata`),
   * index-aligned with `RenderContext.blocks` - invisible blocks stay in the array
   * with `html: ''`. When false, `blocks` is plain rendered HTML strings.
   *
   * @default false
   */
  includeBlockData?: boolean
}

export default class NunjucksBrowserRenderer implements BrowserRenderingEngine {
  private static readonly TEMPLATE_EXTENSION = '.njk'

  private static readonly FALLBACK_TEMPLATE = 'form-step'

  private readonly templateEnv: BrowserTemplateEnvironment

  private readonly defaultTemplate: string

  private readonly includeBlockData: boolean

  private readonly templateCache = new Map<string, { render(context?: object): string }>()

  constructor(options: NunjucksBrowserRendererOptions) {
    this.templateEnv = options.templateEnv
    this.defaultTemplate = options.defaultTemplate ?? NunjucksBrowserRenderer.FALLBACK_TEMPLATE
    this.includeBlockData = options.includeBlockData ?? false
    this.configureTemplateLoaders()
  }

  getAdapterDependencies(): { nunjucksEnv: BrowserTemplateEnvironment } {
    return { nunjucksEnv: this.templateEnv }
  }

  /** Bracket a block's HTML with paired comment markers so devtools can locate it in the rendered DOM. */
  markBlock(nodeId: NodeId, output: string): string {
    return `<!--forge:${nodeId}-->${output}<!--/forge:${nodeId}-->`
  }

  wrapNestedBlock(block: BlockDefinition, output: string): RenderedBlock {
    return { block, html: output }
  }

  assemblePage(
    context: RenderContext,
    renderedBlocks: readonly string[],
    requestState: Record<string, unknown>,
  ): string {
    const templateContext: TemplateContext = {
      ...requestState,
      ...context.step.view?.locals,
      blocks: this.buildTemplateBlocks(context, renderedBlocks),
      step: context.step,
      ancestors: context.ancestors,
      routeTree: context.routeTree,
      navigation: buildNavigationCompatibilityTree(context.routeTree),
      answers: context.answers,
      data: context.data,
      fieldValidationErrors: context.fieldValidationErrors,
      domainValidationErrors: context.domainValidationErrors,
    }

    const template = this.resolveTemplate(context)

    return this.renderTemplate(template, templateContext)
  }

  private configureTemplateLoaders(): void {
    const { loaders } = this.templateEnv

    if (!loaders || !this.templateEnv.invalidateCache) {
      return
    }

    const configuredLoaders = loaders.map(loader =>
      this.isDefaultPrecompiledLoader(loader) ? new NunjucksPrecompiledLoader(loader.precompiled) : loader,
    )

    if (configuredLoaders.every((loader, index) => loader === loaders[index])) {
      return
    }

    this.templateEnv.loaders = configuredLoaders
    // Replacement loaders need caches before Nunjucks can look up templates.
    this.templateEnv.invalidateCache()
  }

  private isDefaultPrecompiledLoader(loader: nunjucks.Loader): loader is PrecompiledTemplateLoader {
    return loader.constructor === nunjucks.PrecompiledLoader
  }

  private buildTemplateBlocks(
    context: RenderContext,
    renderedBlocks: readonly string[],
  ): readonly string[] | readonly TemplateBlock[] {
    if (!this.includeBlockData) {
      return renderedBlocks
    }

    return renderedBlocks.map((html, index) => ({ html, block: context.blocks[index] }))
  }

  private resolveTemplate(context: RenderContext): string {
    const template = context.step.view?.template ?? this.defaultTemplate

    if (!template.endsWith(NunjucksBrowserRenderer.TEMPLATE_EXTENSION)) {
      return `${template}${NunjucksBrowserRenderer.TEMPLATE_EXTENSION}`
    }

    return template
  }

  private renderTemplate(template: string, context: TemplateContext): string {
    let tmpl = this.templateCache.get(template)

    if (!tmpl) {
      tmpl = this.templateEnv.getTemplate(template)
      this.templateCache.set(template, tmpl)
    }

    return tmpl.render(context)
  }
}

function buildNavigationCompatibilityTree(routeTree: RouteTreeNode[]): TemplateNavigationItem[] {
  return routeTree.flatMap(node => toNavigationCompatibilityItems(node))
}

function toNavigationCompatibilityItems(node: RouteTreeNode): TemplateNavigationItem[] {
  const children = node.children.flatMap(child => toNavigationCompatibilityItems(child))

  if (!node.route) {
    return children
  }

  return [
    {
      type: node.route.kind,
      title: node.route.title,
      description: node.route.description,
      path: node.path,
      active: node.active,
      metadata: node.metadata ?? node.route.metadata,
      children,
    },
  ]
}
