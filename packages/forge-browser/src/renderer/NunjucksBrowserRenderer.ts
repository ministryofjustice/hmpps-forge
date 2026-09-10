import type { BlockDefinition, RenderedBlock } from '@ministryofjustice/hmpps-forge/core/components'
import type { ForgeRenderer, NodeId, RenderContext, RouteTreeNode } from '@ministryofjustice/hmpps-forge/core/framework'
import type { BrowserTemplateEnvironment, TemplateBlock, TemplateContext, TemplateNavigationItem } from './types'

export interface NunjucksBrowserRendererOptions {
  /**
   * Template environment used to load and render page templates. The same
   * environment must also be supplied as `adapterDependencies.nunjucksEnv`
   * on the browser app so component templates and macros resolve against it.
   * Supply a `nunjucks-slim` environment with a `BrowserPrecompiledLoader` so
   * nothing compiles in the browser. Compiled templates are cached per
   * renderer instance.
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

export default class NunjucksBrowserRenderer implements ForgeRenderer<string> {
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
