import { MarkdownExtension } from './MarkdownExtension'
import type { ExtensionChunk } from './MarkdownExtension'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Frames a named slot whose content is rendered by Forge. */
export class PreviewExtension extends MarkdownExtension {
  readonly containerName = 'preview'

  renderContainer(chunk: ExtensionChunk): string {
    const { slot, title, caption } = chunk.attrs

    if (!slot || !/^[a-z0-9-]+$/.test(slot)) {
      throw new Error(
        'A preview requires a slot name containing lowercase letters, numbers or hyphens',
      )
    }

    return [
      '<figure class="forge-preview">',
      `  <div class="forge-preview__content"><div data-forge-slot="${slot}"></div></div>`,
      '  <figcaption class="forge-preview__caption">',
      '    <span class="forge-preview__hint">Preview</span>',
      `    <span class="forge-preview__label">${escapeHtml(title || 'Example')}</span>`,
      caption ? `    <span class="forge-preview__description">${escapeHtml(caption)}</span>` : '',
      '  </figcaption>',
      '</figure>',
    ].join('\n')
  }
}
