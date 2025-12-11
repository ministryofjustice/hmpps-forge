import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { ConditionalString, BlockDefinition } from '../../form/types/structures.type'

/**
 * HTML component for rendering raw HTML content.
 * Allows embedding arbitrary HTML markup within forms.
 *
 * WARNING: Use with caution - content is not sanitized.
 * Ensure HTML content comes from trusted sources only.
 *
 * @example
 * ```typescript
 * {
 *   variant: 'html',
 *   content: `
 *     <div>
 *       <p class='govuk-body'>By proceeding, you agree to our
 *          <a href="/terms">Terms of Service</a>
 *       </p>
 *     </div>
 *   `
 * }
 * ```
 */
export interface HtmlBlock extends BlockDefinition {
  variant: 'html'

  /** Raw HTML content to render */
  content: ConditionalString

  /** Additional CSS classes to apply to wrapper div (optional) */
  classes?: ConditionalString

  /** Custom HTML attributes for wrapper div (optional) */
  attributes?: Record<string, any>
}

/**
 * Renders raw HTML content with optional wrapper.
 * The content is embedded directly without sanitization.
 */
export const html = buildComponent<HtmlBlock>('html', async block => {
  const hasWrapper = block.classes || block.attributes

  if (hasWrapper) {
    const classAttr = block.classes ? ` class="${block.classes}"` : ''
    const customAttrs = block.attributes
      ? Object.entries(block.attributes)
          .map(([key, value]) => ` ${key}="${value}"`)
          .join('')
      : ''

    return `<div${classAttr}${customAttrs}>${block.content}</div>`
  }

  return block.content
})
