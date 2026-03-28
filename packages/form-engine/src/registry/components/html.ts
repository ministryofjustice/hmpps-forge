import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { block as blockBuilder } from '@form-engine/form/builders'
import { escapeHtmlEntities } from '@form-engine/core/utils/sanitize'
import { isRenderedBlock } from '@form-engine/form/typeguards/structures'
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
   * HTML tag to render content within. When set, `classes` and `attributes`
   * are applied directly to this element instead of a wrapper `<div>`.
   */
  tag?: string

  /**
   * Content to render. Accepts a string, a dynamic expression, or an array of child blocks.
   * When `tag` is a void element (e.g. `hr`), content is ignored.
   *
   * **WARNING: Not sanitized.** Escape any untrusted data with `Transformer.String.EscapeHtml()`.
   */
  content?: ConditionalString | BlockDefinition[]

  /** Additional CSS classes to apply to the element (optional) */
  classes?: ConditionalString

  /** Custom HTML attributes for the element (optional) */
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

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

const resolveContent = (content: unknown): string => {
  if (Array.isArray(content)) {
    return content.map(item => resolveContent(item)).join('')
  }

  if (isRenderedBlock(content)) {
    return content.html
  }

  return (content as string) ?? ''
}

/**
 * Renders raw HTML content with an optional element tag.
 *
 * When `tag` is set, content is wrapped in that element with `classes` and `attributes`
 * applied directly. When `tag` is not set but `classes`/`attributes` are present, falls
 * back to a wrapper `<div>`.
 *
 * Content can be a string or an array of rendered blocks (e.g. from a collection expression),
 * which are concatenated into a single string.
 *
 * **WARNING: Content is embedded directly without sanitization.**
 * Escape any untrusted data with `Transformer.String.EscapeHtml()`.
 */
export const html = buildComponent<HtmlBlock>('html', block => {
  const hasAttrs = block.classes || block.attributes

  if (!block.tag && !hasAttrs) {
    return resolveContent(block.content)
  }

  const element = block.tag ?? 'div'
  const classAttr = block.classes ? ` class="${escapeHtmlEntities(block.classes)}"` : ''
  const customAttrs = block.attributes
    ? Object.entries(block.attributes)
        .map(([key, value]) => ` ${escapeHtmlEntities(key)}="${escapeHtmlEntities(String(value))}"`)
        .join('')
    : ''

  if (VOID_ELEMENTS.has(element)) {
    return `<${element}${classAttr}${customAttrs}>`
  }

  return `<${element}${classAttr}${customAttrs}>${resolveContent(block.content)}</${element}>`
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
