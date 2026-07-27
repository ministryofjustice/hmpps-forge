import nunjucks from 'nunjucks'
import type {
  BlockDefinition,
  EvaluatedBlock,
  RenderedBlock,
  ComponentRegistryEntry,
} from '@ministryofjustice/hmpps-forge/core/components'
import type { ForgeRenderer, NodeId, RenderContext, RouteTreeNode } from '@ministryofjustice/hmpps-forge/core/framework'
import type { TemplateBlock, TemplateContext, TemplateNavigationItem } from './types'

export interface NunjucksRendererOptions {
  /**
   * Nunjucks environment used to load and render page templates. The same
   * environment is handed to components at render time via their `renderer`
   * parameter, so component templates and macros resolve against it too.
   * Compiled templates are cached per renderer instance.
   */
  nunjucksEnv: nunjucks.Environment

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
   *
   * @example
   * ```njk
   * {% for entry in blocks %}
   *   {% if entry.block.properties.metadata.region == 'sidebar' %}
   *     {{ entry.html | safe }}
   *   {% endif %}
   * {% endfor %}
   * ```
   */
  includeBlockData?: boolean
}

export default class NunjucksRenderer implements ForgeRenderer<string> {
  private static readonly TEMPLATE_EXTENSION = '.njk'

  private static readonly FALLBACK_TEMPLATE = 'form-step'

  private readonly nunjucksEnv: nunjucks.Environment

  private readonly defaultTemplate: string

  private readonly includeBlockData: boolean

  private readonly templateCache = new Map<string, nunjucks.Template>()

  private readonly cachedRenderer: unknown

  constructor(options: NunjucksRendererOptions) {
    this.nunjucksEnv = options.nunjucksEnv
    this.defaultTemplate = options.defaultTemplate ?? NunjucksRenderer.FALLBACK_TEMPLATE
    this.includeBlockData = options.includeBlockData ?? false

    const env = this.nunjucksEnv
    const cache = this.templateCache

    this.cachedRenderer = {
      render(name: string, ctx?: object): string {
        let tmpl = cache.get(name)

        if (!tmpl) {
          tmpl = env.getTemplate(name)
          cache.set(name, tmpl)
        }

        return tmpl.render(ctx)
      },
    }
  }

  renderBlock(entry: ComponentRegistryEntry<BlockDefinition, string>, block: EvaluatedBlock<BlockDefinition>): string {
    const rendered = entry.render(block, this.cachedRenderer)

    if (typeof rendered !== 'string') {
      throw new Error(`Component variant "${block.variant}" must render an HTML string for the Nunjucks adapter.`)
    }

    return rendered
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

    if (!template.endsWith(NunjucksRenderer.TEMPLATE_EXTENSION)) {
      return `${template}${NunjucksRenderer.TEMPLATE_EXTENSION}`
    }

    return template
  }

  private renderTemplate(template: string, context: TemplateContext): string {
    let tmpl = this.templateCache.get(template)

    if (!tmpl) {
      tmpl = this.nunjucksEnv.getTemplate(template)
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
