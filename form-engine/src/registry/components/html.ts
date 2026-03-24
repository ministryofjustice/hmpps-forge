import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { block as blockBuilder } from '@form-engine/form/builders'
import { escapeHtmlEntities } from '@form-engine/core/utils/sanitize'
import { BasicBlockProps, BlockDefinition, ConditionalString } from '../../form/types/structures.type'

/**
 * Props for the HtmlBlock component.
 *
 * Use this to render raw HTML content within forms.
 *
 * **WARNING: XSS Risk — Content is rendered as raw HTML without any sanitization.**
 *
 * Any dynamic data interpolated into the content (e.g. via `Format()`, `Data()`, `Item()`)
 * will be rendered as-is. If that data comes from user input or external sources, it **must**
 * be escaped using `Transformer.String.EscapeHtml()` to prevent injection attacks.
 *
 * @example Safe — static developer HTML:
 * ```typescript
 * HtmlBlock({
 *   content: '<p class="govuk-body">Terms of Service</p>',
 * })
 * ```
 *
 * @example Safe — dynamic data escaped before interpolation:
 * ```typescript
 * HtmlBlock({
 *   content: Format(
 *     '<p class="govuk-body">%1</p>',
 *     Data('goalTitle').pipe(Transformer.String.EscapeHtml()),
 *   ),
 * })
 * ```
 *
 * @example UNSAFE — dynamic data interpolated without escaping:
 * ```typescript
 * // DO NOT do this — vulnerable to XSS if goalTitle contains malicious HTML
 * HtmlBlock({
 *   content: Format('<p class="govuk-body">%1</p>', Data('goalTitle')),
 * })
 * ```
 */
export interface HtmlBlockProps extends BasicBlockProps {
  /**
   * Raw HTML content to render.
   *
   * **WARNING: Not sanitized.** Escape any untrusted data with `Transformer.String.EscapeHtml()`.
   */
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
 *
 * **WARNING: Content is embedded directly without sanitization.**
 * Escape any untrusted data with `Transformer.String.EscapeHtml()`.
 */
export const html = buildComponent<HtmlBlock>('html', block => {
  const hasWrapper = block.classes || block.attributes

  if (hasWrapper) {
    const classAttr = block.classes ? ` class="${escapeHtmlEntities(block.classes)}"` : ''
    const customAttrs = block.attributes
      ? Object.entries(block.attributes)
          .map(([key, value]) => ` ${escapeHtmlEntities(key)}="${escapeHtmlEntities(String(value))}"`)
          .join('')
      : ''

    return `<div${classAttr}${customAttrs}>${block.content}</div>`
  }

  return block.content
})

/**
 * Creates an HTML block for rendering raw HTML content.
 *
 * **WARNING: XSS Risk — Content is rendered as raw HTML without any sanitization.**
 *
 * Escape any untrusted data with `Transformer.String.EscapeHtml()` before interpolation.
 *
 * @see {@link HtmlBlockProps} for full documentation and examples.
 */
export function HtmlBlock(props: HtmlBlockProps): HtmlBlock {
  return blockBuilder<HtmlBlock>({ ...props, variant: 'html' })
}
