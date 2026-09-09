import { MarkdownExtension } from './MarkdownExtension'
import type { ExtensionChunk, RenderMarkdown } from './MarkdownExtension'

/**
 * The `:::note` block: an aside with a fixed "Note" label and a markdown body.
 *
 * ```
 * :::note
 * ---
 * ---
 * Body markdown.
 * :::
 * ```
 *
 * The frontmatter fence is still required by the block parser, but the note
 * takes no attributes - there is one kind of note, and its label is always
 * "Note". Anything declared in the frontmatter is ignored.
 */
export class NoteExtension extends MarkdownExtension {
  readonly containerName = 'note'

  renderContainer(chunk: ExtensionChunk, renderMarkdown: RenderMarkdown): string {
    return [
      '<aside class="forge-note">',
      '  <div class="forge-note__label">Note</div>',
      `  <div class="forge-note__body">${renderMarkdown(chunk.body)}</div>`,
      '</aside>',
    ].join('\n')
  }
}
