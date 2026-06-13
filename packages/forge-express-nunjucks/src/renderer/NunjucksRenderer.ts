import nunjucks from 'nunjucks'
import {
  BlockDefinition,
  ComponentRegistryEntry,
  EvaluatedBlock,
  RenderedBlock,
} from '@ministryofjustice/hmpps-forge/core/components'
import { ForgeRenderer, RenderContext, RouteTreeNode } from '@ministryofjustice/hmpps-forge/core/framework'
import createHttpError from 'http-errors'
import { TemplateContext, TemplateNavigationItem } from './types'

export interface NunjucksRendererOptions {
  nunjucksEnv: nunjucks.Environment

  /**
   * Default template to use when no template is specified in step or ancestors.
   * Defaults to 'form-step'. The .njk extension is appended automatically if not present.
   */
  defaultTemplate?: string
}

/**
 * The Nunjucks rendering backend, bound at orchestrator construction
 * (`new ForgeOrchestrator({ core, renderer: new NunjucksRenderer({ nunjucksEnv }) })` —
 * `createExpressRouter` does this for you). The orchestrator owns the block
 * walk and drives this renderer per block; it owns only the Nunjucks-specific
 * parts — component rendering with the cached env proxy, template resolution,
 * and page assembly.
 */
export default class NunjucksRenderer implements ForgeRenderer<string> {
  private static readonly TEMPLATE_EXTENSION = '.njk'

  private static readonly FALLBACK_TEMPLATE = 'form-step'

  private readonly nunjucksEnv: nunjucks.Environment

  private readonly defaultTemplate: string

  private readonly templateCache = new Map<string, nunjucks.Template>()

  /**
   * A render-compatible proxy passed to components instead of the raw nunjucksEnv.
   * Caches resolved Template objects to avoid repeated loader chain lookups
   * on every component.render() call.
   */
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

  /** Render a single block to HTML via its component, passing the cached env proxy */
  renderBlock(entry: ComponentRegistryEntry<BlockDefinition, string>, block: EvaluatedBlock<BlockDefinition>): string {
    try {
      const rendered = entry.render(block, this.cachedRenderer)

      if (!isStringValue(rendered)) {
        throw new Error(`Component variant "${entry.variant}" must render an HTML string for the Nunjucks renderer.`)
      }

      return rendered
    } catch (err) {
      throw this.wrapError(err)
    }
  }

  /** Wrap a rendered child as RenderedBlock format (block metadata + HTML) */
  wrapNestedBlock(block: BlockDefinition, output: string): RenderedBlock {
    return { block, html: output }
  }

  /** Assemble the full page from pre-rendered blocks and return the HTML string */
  assemblePage(
    context: RenderContext,
    renderedBlocks: readonly string[],
    requestState: Record<string, unknown>,
  ): string {
    const mergedViewLocals = this.mergeViewLocals(context)

    const templateContext: TemplateContext = {
      ...requestState,
      ...mergedViewLocals,
      blocks: [...renderedBlocks],
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

  /** Wrap an error as InternalServerError, preserving stack trace */
  private wrapError(err: unknown) {
    const error = new createHttpError.InternalServerError(err instanceof Error ? err.message : String(err))
    error.cause = err

    if (err instanceof Error && err.stack) {
      error.stack = err.stack
    }

    return error
  }

  /** Resolve template from step, ancestors, or default; appends .njk if needed */
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

  /** Merge view.locals from ancestors and step (later values override) */
  private mergeViewLocals(context: RenderContext): Record<string, unknown> {
    const merged: Record<string, unknown> = {}

    // Merge ancestors in order (root first, then down to immediate parent)
    context.ancestors.forEach(ancestor => {
      if (ancestor.view?.locals) {
        Object.assign(merged, ancestor.view.locals)
      }
    })

    // Merge step last (highest priority)
    if (context.step.view?.locals) {
      Object.assign(merged, context.step.view.locals)
    }

    return merged
  }

  /** Render a Nunjucks template with the given context */
  private renderTemplate(template: string, context: TemplateContext): string {
    try {
      let tmpl = this.templateCache.get(template)

      if (!tmpl) {
        tmpl = this.nunjucksEnv.getTemplate(template)
        this.templateCache.set(template, tmpl)
      }

      return tmpl.render(context)
    } catch (err) {
      throw this.wrapError(err)
    }
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

function isStringValue(value: unknown): value is string {
  return typeof value === 'string'
}
