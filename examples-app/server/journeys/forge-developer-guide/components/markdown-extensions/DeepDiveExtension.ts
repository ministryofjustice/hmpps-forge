import { MarkdownExtension } from './MarkdownExtension'
import type { ExtensionChunk, RenderMarkdown } from './MarkdownExtension'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The `:::deep-dive` block: a highlighted panel with a label, title, optional
 * description, and a collapsible markdown body.
 *
 * ```
 * :::deep-dive
 * ---
 * label: Author detail
 * title: Why this matters
 * description: One-line framing shown above the disclosure.
 * summary: Show more detail
 * defaultOpen: true
 * ---
 * Body markdown.
 * :::
 * ```
 *
 * Output matches the original guide's deep-dive markup (`.forge-deep-dive`),
 * so existing styles apply unchanged.
 */
export class DeepDiveExtension extends MarkdownExtension {
  readonly containerName = 'deep-dive'

  renderContainer(chunk: ExtensionChunk, renderMarkdown: RenderMarkdown): string {
    const label = chunk.attrs.label || 'Deep Dive'
    const title = chunk.attrs.title || 'Deep dive'
    const { description } = chunk.attrs
    const summary = chunk.attrs.summary || 'Show more detail'
    const open = chunk.attrs.defaultOpen === 'true' ? ' open' : ''
    const descriptionHtml = description
      ? `<p class="forge-deep-dive__description">${escapeHtml(description)}</p>\n`
      : ''

    return [
      '<section class="forge-deep-dive">',
      `  <div class="forge-deep-dive__label">${escapeHtml(label)}</div>`,
      `  <h3 class="forge-deep-dive__title">${escapeHtml(title)}</h3>`,
      descriptionHtml,
      `  <details class="forge-deep-dive__details"${open}>`,
      `    <summary class="forge-deep-dive__summary">${escapeHtml(summary)}</summary>`,
      `    <div class="forge-deep-dive__body">${renderMarkdown(chunk.body)}</div>`,
      '  </details>',
      '</section>',
    ].join('\n')
  }
}
