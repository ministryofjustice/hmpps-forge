import nunjucks from 'nunjucks'
import { StructureType } from '@ministryofjustice/hmpps-forge/core/authoring'
import { BlockDefinition, EvaluatedBlock, RenderedBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  ComponentRegistry,
  isBlockStructNode,
  BlockASTNode,
  Evaluated,
  HasNestedBlocksLookup,
  RenderContext,
  RouteTreeNode,
  ValidationResult,
} from '@ministryofjustice/hmpps-forge/core/framework'
import createHttpError from 'http-errors'
import { FieldError, TemplateContext, TemplateNavigationItem } from './types'

export interface TemplateRendererOptions {
  nunjucksEnv: nunjucks.Environment
  componentRegistry: ComponentRegistry
  defaultTemplate?: string
}

/** Renders blocks and page templates using Nunjucks */
export default class TemplateRenderer {
  private static readonly TEMPLATE_EXTENSION = '.njk'

  private static readonly FALLBACK_TEMPLATE = 'form-step'

  private readonly nunjucksEnv: nunjucks.Environment

  private readonly componentRegistry: ComponentRegistry

  private readonly defaultTemplate: string

  private readonly templateCache = new Map<string, nunjucks.Template>()

  /**
   * A render-compatible proxy passed to components instead of the raw nunjucksEnv.
   * Caches resolved Template objects to avoid repeated loader chain lookups
   * on every component.render() call.
   */
  private readonly cachedRenderer: unknown

  constructor(options: TemplateRendererOptions) {
    this.nunjucksEnv = options.nunjucksEnv
    this.componentRegistry = options.componentRegistry
    this.defaultTemplate = options.defaultTemplate ?? TemplateRenderer.FALLBACK_TEMPLATE

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

  /** Wrap an error as InternalServerError, preserving stack trace */
  private wrapError(err: unknown) {
    const error = new createHttpError.InternalServerError(err instanceof Error ? err.message : String(err))
    error.cause = err

    if (err instanceof Error && err.stack) {
      error.stack = err.stack
    }

    return error
  }

  /** Render a full page from RenderContext and return HTML string */
  render(context: RenderContext, locals: Record<string, unknown> = {}): string {
    const renderedBlocks = this.renderBlocks(context.blocks, context.showValidationFailures, context.hasNestedBlocks)

    const mergedViewLocals = this.mergeViewLocals(context)

    const templateContext: TemplateContext = {
      ...locals,
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

    if (!template.endsWith(TemplateRenderer.TEMPLATE_EXTENSION)) {
      return `${template}${TemplateRenderer.TEMPLATE_EXTENSION}`
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

  /** Render all visible blocks to HTML strings (filters out blocks where visibleWhen is false) */
  private renderBlocks(
    blocks: Evaluated<BlockASTNode>[],
    showValidationFailures: boolean,
    hasNestedBlocks?: HasNestedBlocksLookup,
  ): string[] {
    const visibleBlocks = blocks.filter(block => block.properties.visibleWhen !== false)

    return visibleBlocks.map(block => this.renderBlock(block, showValidationFailures, hasNestedBlocks))
  }

  /** Render a single block to HTML using the ComponentRegistry */
  private renderBlock(
    block: Evaluated<BlockASTNode>,
    showValidationFailures: boolean,
    hasNestedBlocks?: HasNestedBlocksLookup,
  ): string {
    try {
      const component = this.componentRegistry.get(block.variant)

      if (!component) {
        const availableVariants = Array.from(this.componentRegistry.getAll().keys())

        throw new Error(
          `Component variant "${block.variant}" not found in registry. ` +
            `Available variants: ${availableVariants.join(', ')}`,
        )
      }

      const needsTransform = !hasNestedBlocks || hasNestedBlocks(block.id)
      const transformedProperties = needsTransform
        ? this.transformPropertiesWithRenderedBlocks(block.properties, showValidationFailures, hasNestedBlocks)
        : block.properties

      const evaluatedBlock = this.toEvaluatedBlock(
        {
          ...block,
          properties: transformedProperties,
        },
        showValidationFailures,
      )

      return component.render(evaluatedBlock, this.cachedRenderer)
    } catch (err) {
      throw this.wrapError(err)
    }
  }

  /** Convert Evaluated<BlockASTNode> to EvaluatedBlock for component */
  private toEvaluatedBlock(block: Evaluated<BlockASTNode>, showErrors: boolean): EvaluatedBlock<BlockDefinition> {
    const errors = showErrors ? this.extractErrorsFromValidations(block.properties.validWhen) : []

    return {
      type: StructureType.BLOCK,
      variant: block.variant,
      ...block.properties,
      errors,
    } as unknown as EvaluatedBlock<BlockDefinition>
  }

  /** Extract failed validation results as error objects */
  private extractErrorsFromValidations(validate: unknown): FieldError[] {
    if (!Array.isArray(validate)) {
      return []
    }

    return (validate as ValidationResult[])
      .filter(result => result.passed === false)
      .map(result => ({
        message: result.message,
        details: result.details,
      }))
  }

  /** Recursively transform properties, rendering nested blocks to HTML */
  private transformPropertiesWithRenderedBlocks(
    properties: Record<string, unknown>,
    showValidationFailures: boolean,
    hasNestedBlocks?: HasNestedBlocksLookup,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    Object.entries(properties).forEach(([key, value]) => {
      result[key] = this.transformValue(value, showValidationFailures, hasNestedBlocks)
    })

    return result
  }

  /** Transform a single value, rendering nested blocks as needed */
  private transformValue(
    value: unknown,
    showValidationFailures: boolean,
    hasNestedBlocks?: HasNestedBlocksLookup,
  ): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (isBlockStructNode(value)) {
      return this.renderNestedBlock(value as Evaluated<BlockASTNode>, showValidationFailures, hasNestedBlocks)
    }

    if (Array.isArray(value)) {
      const transformed = value.map(element => this.transformValue(element, showValidationFailures, hasNestedBlocks))

      // Filter out null values (non-visible nested blocks)
      return transformed.filter(item => item !== null)
    }

    if (typeof value === 'object') {
      return this.transformPropertiesWithRenderedBlocks(
        value as Record<string, unknown>,
        showValidationFailures,
        hasNestedBlocks,
      )
    }

    return value
  }

  /** Render a nested block to RenderedBlock format (block metadata + HTML) */
  private renderNestedBlock(
    block: Evaluated<BlockASTNode>,
    showValidationFailures: boolean,
    hasNestedBlocks?: HasNestedBlocksLookup,
  ): RenderedBlock | null {
    const { visibleWhen, ...properties } = block.properties

    // Skip blocks where visibleWhen is false
    if (block.properties.visibleWhen === false) {
      return null
    }

    const html = this.renderBlock(block, showValidationFailures, hasNestedBlocks)

    return {
      block: {
        type: StructureType.BLOCK,
        blockType: block.blockType,
        variant: block.variant,
        ...properties,
      },
      html,
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
