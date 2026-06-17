import nunjucks from 'nunjucks'
import type {
  BlockDefinition,
  EvaluatedBlock,
  RenderedBlock,
  ComponentRegistryEntry,
} from '@ministryofjustice/hmpps-forge/core/components'
import type { ForgeRenderer, RenderContext, RouteTreeNode } from '@ministryofjustice/hmpps-forge/core/framework'
import type { TemplateContext, TemplateNavigationItem } from './types'

export interface NunjucksRendererOptions {
  nunjucksEnv: nunjucks.Environment
  defaultTemplate?: string
}

export default class NunjucksRenderer implements ForgeRenderer<string> {
  private static readonly TEMPLATE_EXTENSION = '.njk'

  private static readonly FALLBACK_TEMPLATE = 'form-step'

  private readonly nunjucksEnv: nunjucks.Environment

  private readonly defaultTemplate: string

  private readonly templateCache = new Map<string, nunjucks.Template>()

  private readonly cachedRenderer: unknown

  constructor(options: NunjucksRendererOptions) {
    this.nunjucksEnv = options.nunjucksEnv
    this.defaultTemplate = options.defaultTemplate ?? NunjucksRenderer.FALLBACK_TEMPLATE

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

  wrapNestedBlock(block: BlockDefinition, output: string): RenderedBlock {
    return { block, html: output }
  }

  assemblePage(
    context: RenderContext,
    renderedBlocks: readonly string[],
    requestState: Record<string, unknown>,
  ): string {
    const mergedViewLocals = this.mergeViewLocals(context)

    const templateContext: TemplateContext = {
      ...requestState,
      ...mergedViewLocals,
      blocks: renderedBlocks,
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

  private resolveTemplate(context: RenderContext): string {
    let template: string

    if (context.step.view?.template) {
      template = context.step.view.template
    } else {
      const reversedAncestors = [...context.ancestors].reverse()
      const ancestorWithTemplate = reversedAncestors.find(ancestor => ancestor.view?.template)

      template = ancestorWithTemplate?.view?.template ?? this.defaultTemplate
    }

    if (!template.endsWith(NunjucksRenderer.TEMPLATE_EXTENSION)) {
      return `${template}${NunjucksRenderer.TEMPLATE_EXTENSION}`
    }

    return template
  }

  private mergeViewLocals(context: RenderContext): Record<string, unknown> {
    const merged: Record<string, unknown> = {}

    context.ancestors.forEach(ancestor => {
      if (ancestor.view?.locals) {
        Object.assign(merged, ancestor.view.locals)
      }
    })

    if (context.step.view?.locals) {
      Object.assign(merged, context.step.view.locals)
    }

    return merged
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
