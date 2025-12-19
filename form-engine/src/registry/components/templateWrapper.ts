import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { isRenderedBlock } from '@form-engine/form/typeguards/structures'
import { BlockDefinition, ConditionalString, EvaluatedBlock } from '../../form/types/structures.type'

/**
 * Template wrapper component for wrapping child blocks in an HTML template.
 * Allows defining an HTML template with slots where child blocks will be injected.
 *
 * Slots in the template use the syntax `{{slot:slotName}}` and will be replaced
 * with the rendered HTML of the corresponding blocks in the `slots` property.
 *
 * Values in the template use the syntax `{{valueName}}` and will be replaced
 * with the corresponding string value from the `values` property.
 *
 * @example
 * ```typescript
 * block<TemplateWrapper>({
 *   variant: 'templateWrapper',
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
 *       block<HtmlBlock>({ variant: 'html', content: '<p>Explanation...</p>' }),
 *       block<GovUKCodeBlock>({ variant: 'govukCodeBlock', code: '...' }),
 *     ]
 *   }
 * })
 * ```
 */
export interface TemplateWrapper extends BlockDefinition {
  variant: 'templateWrapper'

  /** HTML template with slot markers ({{slot:name}}) and value markers ({{name}}) */
  template: ConditionalString

  /** String values to inject into the template at {{name}} markers */
  values?: Record<string, ConditionalString>

  /** Named slots containing blocks to render at {{slot:name}} markers */
  slots?: Record<string, BlockDefinition[]>

  /** Additional CSS classes to apply to wrapper div (optional) */
  classes?: ConditionalString

  /** Custom HTML attributes for wrapper div (optional) */
  attributes?: Record<string, any>
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
const renderTemplateWrapper = async (block: EvaluatedBlock<TemplateWrapper>): Promise<string> => {
  let content = block.template

  // Replace value markers: {{valueName}}
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

  const hasWrapper = block.classes || block.attributes

  if (hasWrapper) {
    const classAttr = block.classes ? ` class="${block.classes}"` : ''
    const customAttrs = block.attributes
      ? Object.entries(block.attributes)
          .map(([key, value]) => ` ${key}="${value}"`)
          .join('')
      : ''

    return `<div${classAttr}${customAttrs}>${content}</div>`
  }

  return content
}

export const templateWrapper = buildComponent<TemplateWrapper>('templateWrapper', renderTemplateWrapper as any)
