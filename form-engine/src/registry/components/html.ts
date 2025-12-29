import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { block as blockBuilder } from '@form-engine/form/builders'
import { BasicBlockProps, BlockDefinition, ConditionalString } from '../../form/types/structures.type'

/**
 * Props for the HtmlBlock component.
 *
 * Use this to render raw HTML content within forms.
 * Content is embedded directly without sanitization, so ensure HTML
 * comes from trusted sources only.
 *
 * @example
 * ```typescript
 * HtmlBlock({
 *   content: `
 *     <div>
 *       <p class='govuk-body'>By proceeding, you agree to our
 *          <a href="/terms">Terms of Service</a>
 *       </p>
 *     </div>
 *   `,
 * })
 * ```
 */
export interface HtmlBlockProps extends BasicBlockProps {
  /** Raw HTML content to render */
  content: ConditionalString

  /** Additional CSS classes to apply to wrapper div (optional) */
  classes?: ConditionalString

  /** Custom HTML attributes for wrapper div (optional) */
  attributes?: Record<string, any>
}

/**
 * HTML Block component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `HtmlBlockProps` type or the `HtmlBlock()` wrapper function instead.
 */
export interface HtmlBlock extends BlockDefinition, HtmlBlockProps {
  /** Component variant identifier */
  variant: 'html'
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

/**
 * Creates an HTML block for rendering raw HTML content.
 * Content is embedded directly without sanitization.
 *
 * @example
 * ```typescript
 * HtmlBlock({
 *   content: `
 *     <p class='govuk-body'>By proceeding, you agree to our
 *        <a href="/terms">Terms of Service</a>
 *     </p>
 *   `,
 * })
 * ```
 */
export function HtmlBlock(props: HtmlBlockProps): HtmlBlock {
  return blockBuilder<HtmlBlock>({ ...props, variant: 'html' })
}
