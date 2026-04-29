import { buildComponent } from '../utils/buildComponent'
import { block as blockBuilder } from '../../authoring/builders'
import { isRenderedBlock } from '../../authoring/typeguards/structures'
import { escapeHtmlEntities } from '../../shared/utils/sanitize'
import type { BasicBlockProps, BlockDefinition, ResolvableString, EvaluatedBlock } from '../types/structures.type'

/**
 * Props for the TemplateWrapper component.
 *
 * Template wrapper allows wrapping child blocks in an HTML template.
 * Slots in the template use the syntax `{{slot:slotName}}` and will be replaced
 * with the rendered HTML of the corresponding blocks in the `slots` property.
 *
 * Values in the template use the syntax `{{valueName}}` and will be replaced
 * with the corresponding string value from the `values` property.
 *
 * @example
 * ```typescript
 * TemplateWrapper({
 *   template: `
 *     <section class="govuk-section">
 *       <h2 class="govuk-heading-m">{{title}}</h2>
 *       {{slot:content}}
 *       <p class="govuk-body-s">{{footer}}</p>
 *     </section>
 *   `,
 *   values: {
 *     title: 'Journey Configuration',
 *     footer: 'See the next page for step configuration.'
 *   },
 *   slots: {
 *     content: [
 *       HtmlBlock({ content: '<p>Explanation...</p>' }),
 *       GovUKCodeBlock({ code: '...' }),
 *     ]
 *   }
 * })
 * ```
 */
export interface TemplateWrapperProps extends BasicBlockProps {
  /**
   * HTML template with slot markers ({{slot:name}}) and value markers ({{name}}).
   *
   * @example '<div class="wrapper">{{slot:content}}</div>'
   * @example '<h2>{{title}}</h2>{{slot:body}}'
   */
  template: ResolvableString

  /**
   * String values to inject into the template at {{name}} markers.
   *
   * **WARNING: Not sanitized.** Values are injected directly into the HTML template.
   * Escape any untrusted data with `Transformer.String.EscapeHtml()`.
   *
   * @example { title: 'Section Title', footer: 'Footer text' }
   */
  values?: Record<string, ResolvableString>

  /**
   * Named slots containing blocks to render at {{slot:name}} markers.
   *
   * @example { content: [HtmlBlock({ content: '<p>Hello</p>' })] }
   */
  slots?: Record<string, BlockDefinition[]>

  /**
   * HTML tag to render content within. When set, `classes` and `attributes`
   * are applied directly to this element instead of a wrapper `<div>`.
   *
   * @example 'section'
   */
  tag?: string

  /**
   * Additional CSS classes to apply to the wrapper element (optional).
   * Only applies when a wrapper element is rendered.
   *
   * @example 'govuk-!-margin-bottom-6'
   */
  classes?: ResolvableString

  /**
   * Custom HTML attributes for the wrapper element (optional).
   * Only applies when a wrapper element is rendered.
   *
   * @example { 'data-module': 'template-section' }
   */
  attributes?: Record<string, any>
}

/**
 * TemplateWrapper Component
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `TemplateWrapperProps` type or the `TemplateWrapper()` wrapper function instead.
 */
export interface TemplateWrapper extends BlockDefinition, TemplateWrapperProps {
  /** Component variant identifier */
  variant: 'templateWrapper'
}

/**
 * Extracts a string value from a value that could be:
 * - A plain string
 * - A rendered block (with .html and .block properties)
 * - An array of strings or rendered blocks
 */
const extractStringValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(v => extractStringValue(v)).join('')
  }

  if (isRenderedBlock(value)) {
    return value.html
  }

  return (value as string) ?? ''
}

/**
 * Renders the template wrapper by replacing slot markers with rendered block HTML
 * and value markers with their corresponding values.
 */
const renderTemplateWrapper = (block: EvaluatedBlock<TemplateWrapper>): string => {
  let content = block.template

  // Replace value markers: {{valueName}}
  // Values are developer-controlled (not user input), so no escaping needed.
  // User input flows through form fields and is escaped by Nunjucks at render time.
  if (block.values) {
    Object.entries(block.values).forEach(([key, value]) => {
      const marker = `{{${key}}}`
      const stringValue = extractStringValue(value)
      content = content.split(marker).join(stringValue)
    })
  }

  // Replace slot markers: {{slot:slotName}}
  if (block.slots) {
    Object.entries(block.slots).forEach(([slotName, renderedBlocks]) => {
      const marker = `{{slot:${slotName}}}`
      const slotHtml = renderedBlocks.map(b => b.html).join('')
      content = content.split(marker).join(slotHtml)
    })
  }

  // Clean up any unreplaced markers (slots/values that weren't provided)
  content = content.replace(/\{\{slot:[^}]+}}/g, '')
  content = content.replace(/\{\{[^}]+}}/g, '')

  const hasWrapper = block.tag || block.classes || block.attributes

  if (hasWrapper) {
    const element = block.tag ?? 'div'
    const classAttr = block.classes ? ` class="${escapeHtmlEntities(block.classes)}"` : ''
    const customAttrs = block.attributes
      ? Object.entries(block.attributes)
          .map(([key, value]) => ` ${escapeHtmlEntities(key)}="${escapeHtmlEntities(String(value))}"`)
          .join('')
      : ''

    return `<${element}${classAttr}${customAttrs}>${content}</${element}>`
  }

  return content
}

export const templateWrapper = buildComponent<TemplateWrapper>('templateWrapper', renderTemplateWrapper as any)

/**
 * Creates a TemplateWrapper block.
 * Wraps child blocks in an HTML template with slot and value substitution.
 *
 * @example
 * ```typescript
 * TemplateWrapper({
 *   template: '<div class="card">{{slot:content}}</div>',
 *   slots: {
 *     content: [HtmlBlock({ content: '<p>Card content</p>' })]
 *   }
 * })
 * ```
 */
export function TemplateWrapper(props: TemplateWrapperProps): TemplateWrapper {
  return blockBuilder<TemplateWrapper>({ ...props, variant: 'templateWrapper' })
}
