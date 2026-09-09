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

interface Frame {
  title: string
  slide: string
  description: string
}

/**
 * The `::::frame-sequence` block: a stepped carousel of slides, each with its
 * own caption in the panel beneath the viewport.
 *
 * ```
 * ::::frame-sequence
 * ---
 * title: Journey lifecycle
 * ---
 *
 * :::frame
 * ---
 * title: Validate submission
 * ---
 * ```mermaid
 * flowchart LR
 *   A --> B
 * ```
 * ===
 * Each field's rules fire in order.
 * :::
 * ::::
 * ```
 *
 * Four colons open the block so the nested three-colon `:::frame` blocks are
 * left in the body for this extension to parse. Within a frame, everything
 * above the `===` divider is the slide and everything below it is the caption's
 * description; a frame without a divider is all slide.
 *
 * Every frame, caption, and dot is rendered server-side and the first one is
 * marked active, so the block reads correctly without JavaScript - the client
 * module only toggles what's already there. A body with no parseable frames
 * falls back to plain markdown rendering, so malformed content stays visible on
 * the page rather than disappearing into an empty carousel.
 */
export class FrameSequenceExtension extends MarkdownExtension {
  readonly containerName = 'frame-sequence'

  renderContainer(chunk: ExtensionChunk, renderMarkdown: RenderMarkdown): string {
    const frames = this.parseFrames(chunk.body)

    if (frames.length === 0) {
      return renderMarkdown(chunk.body)
    }

    const title = escapeHtml(chunk.attrs.title || 'Frame sequence')

    return [
      '<section class="forge-frame-sequence" data-module="forge-frame-sequence">',
      '  <div class="forge-frame-sequence__header">',
      `    <h3 class="forge-frame-sequence__title">${title}</h3>`,
      '  </div>',
      `  <div class="forge-frame-sequence__viewport" tabindex="0" role="group" aria-roledescription="carousel" aria-label="${title}">`,
      '    <div class="forge-frame-sequence__track">',
      ...this.renderFrames(frames, renderMarkdown),
      '    </div>',
      '  </div>',
      '  <div class="forge-frame-sequence__panel" aria-live="polite">',
      ...this.renderCaptions(frames, renderMarkdown),
      '  </div>',
      '  <div class="forge-frame-sequence__footer">',
      '    <button type="button" class="forge-frame-sequence__nav forge-frame-sequence__nav--prev" disabled>&#9664; Previous</button>',
      '    <div class="forge-frame-sequence__dots">',
      ...this.renderDots(frames.length),
      '    </div>',
      '    <button type="button" class="forge-frame-sequence__nav forge-frame-sequence__nav--next">Next &#9654;</button>',
      '  </div>',
      '</section>',
    ].join('\n')
  }

  private parseFrames(body: string): Frame[] {
    const lines = body.split('\n')
    const frames: Frame[] = []
    let index = 0

    while (index < lines.length) {
      const parsedFrame = this.parseFrame(lines, index)

      if (parsedFrame) {
        frames.push(parsedFrame.frame)
        index = parsedFrame.nextIndex
      } else {
        index += 1
      }
    }

    return frames.map((frame, frameIndex) => ({
      ...frame,
      title: frame.title || `Frame ${frameIndex + 1}`,
    }))
  }

  // A frame is `:::frame`, an immediate `---`-fenced frontmatter section, a
  // body, and a closing `:::`. The closing fence is found first so it bounds
  // the search for the frontmatter's end: a frame whose frontmatter never
  // closes then costs only itself, rather than swallowing the frames after it.
  private parseFrame(
    lines: string[],
    startIndex: number,
  ): { frame: Frame; nextIndex: number } | undefined {
    if (lines[startIndex].trim() !== ':::frame') {
      return undefined
    }

    const frontmatterStart = startIndex + 1

    if (lines[frontmatterStart]?.trim() !== '---') {
      return undefined
    }

    const frameEnd = lines.findIndex(
      (line, index) => index > frontmatterStart && line.trim() === ':::',
    )

    if (frameEnd === -1) {
      return undefined
    }

    const frontmatterEnd = lines.findIndex(
      (line, index) => index > frontmatterStart && index < frameEnd && line.trim() === '---',
    )

    if (frontmatterEnd === -1) {
      return undefined
    }

    const attrs = this.parseFrameAttrs(lines.slice(frontmatterStart + 1, frontmatterEnd))
    const bodyLines = lines.slice(frontmatterEnd + 1, frameEnd)
    const dividerIndex = bodyLines.findIndex(line => line.trim() === '===')
    const slideLines = dividerIndex === -1 ? bodyLines : bodyLines.slice(0, dividerIndex)
    const descriptionLines = dividerIndex === -1 ? [] : bodyLines.slice(dividerIndex + 1)

    return {
      frame: {
        title: attrs.title ?? '',
        slide: slideLines.join('\n').trim(),
        description: descriptionLines.join('\n').trim(),
      },
      nextIndex: frameEnd + 1,
    }
  }

  private parseFrameAttrs(lines: string[]): Record<string, string> {
    return Object.fromEntries(
      lines.flatMap(line => {
        const colon = line.indexOf(':')

        if (colon === -1) {
          return []
        }

        const key = line.slice(0, colon).trim()
        const value = line.slice(colon + 1).trim()

        if (!key) {
          return []
        }

        // Values are taken verbatim - no quote stripping - matching the block
        // parser's own frontmatter rule.
        return [[key, value]]
      }),
    )
  }

  private renderFrames(frames: Frame[], renderMarkdown: RenderMarkdown): string[] {
    return frames.map(
      (frame, index) =>
        `      <div class="forge-frame-sequence__frame" data-frame-index="${index}">${renderMarkdown(frame.slide)}</div>`,
    )
  }

  private renderCaptions(frames: Frame[], renderMarkdown: RenderMarkdown): string[] {
    return frames.map((frame, index) => {
      const hidden = index === 0 ? '' : ' hidden'

      return [
        `    <div class="forge-frame-sequence__caption"${hidden}>`,
        `      <p class="forge-frame-sequence__eyebrow">Frame ${index + 1} of ${frames.length}</p>`,
        `      <h4 class="forge-frame-sequence__caption-title">${escapeHtml(frame.title)}</h4>`,
        `      <div class="forge-frame-sequence__description">${renderMarkdown(frame.description)}</div>`,
        '    </div>',
      ].join('\n')
    })
  }

  private renderDots(frameCount: number): string[] {
    return Array.from({ length: frameCount }, (_, index) => {
      const activeClass = index === 0 ? ' forge-frame-sequence__dot--active' : ''
      const current = index === 0 ? ' aria-current="true"' : ''

      return `      <button type="button" class="forge-frame-sequence__dot${activeClass}" aria-label="Go to frame ${index + 1}"${current}></button>`
    })
  }
}
