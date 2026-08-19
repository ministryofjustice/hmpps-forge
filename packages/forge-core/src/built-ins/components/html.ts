import { component } from '../../components/component'
import { escapeHtmlEntities } from '../sanitize'
import { isRenderedBlock } from '../../components/typeguards'
import type { BlockDefinition, ResolvableString } from '../../components/types/structures.type'

/**
 * HTML Block component.
 *
 * Use this to render raw HTML content within forms.
 *
 * When `tag` is set, content is wrapped in that element with `classes` and `attributes`
 * applied directly. When `tag` is not set but `classes`/`attributes` are present, falls
 * back to a wrapper `<div>`. Content can be a string or an array of rendered blocks
 * (e.g. from a collection expression), which are concatenated into a single string.
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
export interface HtmlBlock extends BlockDefinition {
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
  content?: ResolvableString | BlockDefinition | BlockDefinition[]

  /** Additional CSS classes to apply to the element (optional) */
  classes?: ResolvableString

  /** Custom HTML attributes for the element (optional) */
  attributes?: Record<string, any>
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
 * HTML Block component.
 *
 * Use this to render raw HTML content within forms.
 *
 * When `tag` is set, content is wrapped in that element with `classes` and `attributes`
 * applied directly. When `tag` is not set but `classes`/`attributes` are present, falls
 * back to a wrapper `<div>`. Content can be a string or an array of rendered blocks
 * (e.g. from a collection expression), which are concatenated into a single string.
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
export const HtmlBlock = component<HtmlBlock>('html', {
  render: props => {
    const hasAttrs = props.classes || props.attributes

    if (!props.tag && !hasAttrs) {
      return resolveContent(props.content)
    }

    const element = props.tag ?? 'div'
    const classAttr = props.classes ? ` class="${escapeHtmlEntities(props.classes)}"` : ''
    const customAttrs = props.attributes
      ? Object.entries(props.attributes)
          .map(([key, value]) => ` ${escapeHtmlEntities(key)}="${escapeHtmlEntities(String(value))}"`)
          .join('')
      : ''

    if (VOID_ELEMENTS.has(element)) {
      return `<${element}${classAttr}${customAttrs}>`
    }

    return `<${element}${classAttr}${customAttrs}>${resolveContent(props.content)}</${element}>`
  },
})
