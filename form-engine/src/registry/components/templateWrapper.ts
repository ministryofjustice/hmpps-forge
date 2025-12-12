import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { StructureType } from '@form-engine/form/types/enums'
import { BlockDefinition, ConditionalString, RenderedBlock } from '../../form/types/structures.type'

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
 * Runtime representation of a template wrapper after evaluation.
 * Slot blocks are rendered to HTML and values are evaluated to strings.
 */
export interface EvaluatedTemplateWrapper {
  type: typeof StructureType.BLOCK
  variant: 'templateWrapper'

  /** The evaluated HTML template */
  template: string

  /** Evaluated string values */
  values?: Record<string, string>

  /** The rendered blocks for each slot */
  slots?: Record<string, RenderedBlock[]>

  /** Additional CSS classes applied to wrapper div */
  classes?: string

  /** Custom HTML attributes for wrapper div */
  attributes?: Record<string, string>
}

/**
 * Renders the template wrapper by replacing slot markers with rendered block HTML
 * and value markers with their corresponding values.
 */
const renderTemplateWrapper = async (block: EvaluatedTemplateWrapper): Promise<string> => {
  let content = block.template

  // Replace value markers: {{valueName}}
  if (block.values) {
    Object.entries(block.values).forEach(([key, value]) => {
      const marker = `{{${key}}}`
      content = content.split(marker).join(value ?? '')
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
