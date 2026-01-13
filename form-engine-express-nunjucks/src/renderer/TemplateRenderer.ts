import nunjucks from 'nunjucks'
import { InternalServerError } from 'http-errors'
import { RenderContext, Evaluated } from '@form-engine/core/runtime/rendering/types'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { StructureType } from '@form-engine/form/types/enums'
import { BlockDefinition, EvaluatedBlock, RenderedBlock } from '@form-engine/form/types/structures.type'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { ValidationResult } from '@form-engine/core/nodes/expressions/validation/ValidationHandler'
import { FieldError, TemplateContext, ValidationError } from './types'

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

  constructor(options: TemplateRendererOptions) {
    this.nunjucksEnv = options.nunjucksEnv
    this.componentRegistry = options.componentRegistry
    this.defaultTemplate = options.defaultTemplate ?? TemplateRenderer.FALLBACK_TEMPLATE
  }

  /** Wrap an error as InternalServerError, preserving stack trace */
  private wrapError(err: unknown) {
    const error = new InternalServerError(err instanceof Error ? err.message : String(err))
    error.cause = err

    if (err instanceof Error && err.stack) {
      error.stack = err.stack
    }

    return error
  }

  /** Render a full page from RenderContext and return HTML string */
  async render(context: RenderContext, locals: Record<string, unknown> = {}): Promise<string> {
    const renderedBlocks = await this.renderBlocks(context.blocks, context.showValidationFailures)
    const mergedViewLocals = this.mergeViewLocals(context)
    const validationErrors = context.showValidationFailures ? this.collectValidationErrors(context.blocks) : []

    const templateContext: TemplateContext = {
      ...locals,
      ...mergedViewLocals,
      blocks: renderedBlocks,
      step: context.step,
      ancestors: context.ancestors,
      navigation: context.navigation,
      answers: context.answers,
      data: context.data,
      validationErrors,
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
  private renderTemplate(template: string, context: TemplateContext): Promise<string> {
    return new Promise((resolve, reject) => {
      this.nunjucksEnv.render(template, context, (err, result) => {
        if (err) {
          reject(this.wrapError(err))
          return
        }

        resolve(result ?? '')
      })
    })
  }

  /** Render all visible blocks to HTML strings (filters out hidden blocks) */
  private async renderBlocks(blocks: Evaluated<BlockASTNode>[], showValidationFailures: boolean): Promise<string[]> {
    const visibleBlocks = blocks.filter(block => block.properties.hidden !== true)

    return Promise.all(visibleBlocks.map(block => this.renderBlock(block, showValidationFailures)))
  }

  /** Render a single block to HTML using the ComponentRegistry */
  private async renderBlock(block: Evaluated<BlockASTNode>, showValidationFailures: boolean): Promise<string> {
    try {
      const component = this.componentRegistry.get(block.variant)

      if (!component) {
        const availableVariants = Array.from(this.componentRegistry.getAll().keys())

        throw new Error(
          `Component variant "${block.variant}" not found in registry. ` +
            `Available variants: ${availableVariants.join(', ')}`,
        )
      }

      const transformedProperties = await this.transformPropertiesWithRenderedBlocks(
        block.properties,
        showValidationFailures,
      )

      const evaluatedBlock = this.toEvaluatedBlock(
        {
          ...block,
          properties: transformedProperties,
        },
        showValidationFailures,
      )

      return await component.render(evaluatedBlock, this.nunjucksEnv)
    } catch (err) {
      throw this.wrapError(err)
    }
  }

  /** Convert Evaluated<BlockASTNode> to EvaluatedBlock for component */
  private toEvaluatedBlock(block: Evaluated<BlockASTNode>, showErrors: boolean): EvaluatedBlock<BlockDefinition> {
    const errors = showErrors ? this.extractErrorsFromValidations(block.properties.validate) : []

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

  // Collect all validation errors from blocks for error summary
  private collectValidationErrors(blocks: Evaluated<BlockASTNode>[]): ValidationError[] {
    const errors: ValidationError[] = []
    this.collectValidationErrorsRecursive(blocks, errors)
    return errors
  }

  // Recursively collect validation errors from blocks and nested structures
  private collectValidationErrorsRecursive(blocks: Evaluated<BlockASTNode>[], errors: ValidationError[]): void {
    for (const block of blocks) {
      if (block.properties.hidden !== true) {
        const code = block.properties.code as string | undefined
        const validate = block.properties.validate

        if (code && Array.isArray(validate)) {
          const failedValidations = (validate as ValidationResult[]).filter(result => result.passed === false)

          for (const validation of failedValidations) {
            errors.push({
              text: validation.message,
              href: `#${code}`,
            })
          }
        }
        // Recursively check nested blocks in properties
        this.collectNestedValidationErrors(block.properties, errors)
      }
    }
  }

  // Recursively search for validation errors in nested properties
  private collectNestedValidationErrors(properties: Record<string, unknown>, errors: ValidationError[]): void {
    for (const value of Object.values(properties)) {
      if (value !== null && value !== undefined) {
        // Check if this is a nested block
        if (isBlockStructNode(value)) {
          this.collectValidationErrorsRecursive([value as Evaluated<BlockASTNode>], errors)
        }
        // Check arrays for nested blocks
        if (Array.isArray(value)) {
          for (const item of value) {
            if (isBlockStructNode(item)) {
              this.collectValidationErrorsRecursive([item as Evaluated<BlockASTNode>], errors)
            } else if (typeof item === 'object' && item !== null) {
              this.collectNestedValidationErrors(item as Record<string, unknown>, errors)
            }
          }
        }
        // Check nested objects
        if (typeof value === 'object' && !Array.isArray(value) && !isBlockStructNode(value)) {
          this.collectNestedValidationErrors(value as Record<string, unknown>, errors)
        }
      }
    }
  }

  /** Recursively transform properties, rendering nested blocks to HTML */
  private async transformPropertiesWithRenderedBlocks(
    properties: Record<string, unknown>,
    showValidationFailures: boolean,
  ): Promise<Record<string, unknown>> {
    const entries = Object.entries(properties)
    const transformedEntries = await Promise.all(
      entries.map(async ([key, value]) => {
        const transformedValue = await this.transformValue(value, showValidationFailures)

        return [key, transformedValue]
      }),
    )

    return Object.fromEntries(transformedEntries)
  }

  /** Transform a single value, rendering nested blocks as needed */
  private async transformValue(value: unknown, showValidationFailures: boolean): Promise<unknown> {
    if (value === null || value === undefined) {
      return value
    }

    if (isBlockStructNode(value)) {
      return this.renderNestedBlock(value as Evaluated<BlockASTNode>, showValidationFailures)
    }

    if (Array.isArray(value)) {
      const transformed = await Promise.all(value.map(element => this.transformValue(element, showValidationFailures)))

      // Filter out null values (hidden nested blocks)
      return transformed.filter(item => item !== null)
    }

    if (typeof value === 'object') {
      return this.transformPropertiesWithRenderedBlocks(value as Record<string, unknown>, showValidationFailures)
    }

    return value
  }

  /** Render a nested block to RenderedBlock format (block metadata + HTML) */
  private async renderNestedBlock(
    block: Evaluated<BlockASTNode>,
    showValidationFailures: boolean,
  ): Promise<RenderedBlock | null> {
    const { hidden, ...properties } = block.properties
    // Skip hidden nested blocks
    if (block.properties.hidden === true) {
      return null
    }

    const html = await this.renderBlock(block, showValidationFailures)

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
