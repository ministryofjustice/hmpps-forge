import { describe, expect, it } from 'vitest'
import { FrameSequenceExtension } from './FrameSequenceExtension'
import type { ExtensionChunk } from './MarkdownExtension'

function frameSequenceChunk(attrs: Record<string, string>, body: string): ExtensionChunk {
  return { kind: 'extension', containerName: 'frame-sequence', attrs, body, children: [] }
}

const twoFrameBody = `:::frame
---
title: Validate submission
---
The first slide.
===
The first description.
:::

:::frame
---
title: Persist answers
---
The second slide.
===
The second description.
:::`

describe('FrameSequenceExtension', () => {
  describe('renderContainer()', () => {
    it('should render the header title and one slide per frame when the body contains two frames', () => {
      // Arrange
      const extension = new FrameSequenceExtension()
      const chunk = frameSequenceChunk({ title: 'Journey lifecycle' }, twoFrameBody)

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain(
        '<section class="forge-frame-sequence" data-module="forge-frame-sequence">',
      )
      expect(result).toContain('<h3 class="forge-frame-sequence__title">Journey lifecycle</h3>')
      expect(result).toContain('aria-label="Journey lifecycle"')
      expect(result).toContain(
        '<div class="forge-frame-sequence__frame" data-frame-index="0"><p>The first slide.</p></div>',
      )
      expect(result).toContain(
        '<div class="forge-frame-sequence__frame" data-frame-index="1"><p>The second slide.</p></div>',
      )
      expect(result).toContain('Validate submission')
      expect(result).toContain('Persist answers')
    })

    it('should render per-frame eyebrow counters and hide captions after the first when rendered server-side', () => {
      // Arrange
      const extension = new FrameSequenceExtension()
      const chunk = frameSequenceChunk({ title: 'Journey lifecycle' }, twoFrameBody)

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain('<div class="forge-frame-sequence__caption">')
      expect(result).toContain('<div class="forge-frame-sequence__caption" hidden>')
      expect(result).toContain('<p class="forge-frame-sequence__eyebrow">Frame 1 of 2</p>')
      expect(result).toContain('<p class="forge-frame-sequence__eyebrow">Frame 2 of 2</p>')
    })

    it('should split slide from description at the === divider when a frame contains one', () => {
      // Arrange
      const extension = new FrameSequenceExtension()
      const chunk = frameSequenceChunk(
        {},
        `:::frame
---
title: Validate submission
---
The slide.
===
The description.
:::`,
      )

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain(
        '<div class="forge-frame-sequence__frame" data-frame-index="0"><p>The slide.</p></div>',
      )
      expect(result).toContain(
        '<div class="forge-frame-sequence__description"><p>The description.</p></div>',
      )
    })

    it('should use the whole body as the slide when a frame has no divider', () => {
      // Arrange
      const extension = new FrameSequenceExtension()
      const chunk = frameSequenceChunk(
        {},
        `:::frame
---
title: Validate submission
---
The only content.
:::`,
      )

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain(
        '<div class="forge-frame-sequence__frame" data-frame-index="0"><p>The only content.</p></div>',
      )
      expect(result).toContain('<div class="forge-frame-sequence__description"><p></p></div>')
    })

    it('should disable the previous button and mark the first dot active when rendered server-side', () => {
      // Arrange
      const extension = new FrameSequenceExtension()
      const chunk = frameSequenceChunk({}, twoFrameBody)

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain(
        '<button type="button" class="forge-frame-sequence__nav forge-frame-sequence__nav--prev" disabled>&#9664; Previous</button>',
      )
      expect(result).toContain(
        '<button type="button" class="forge-frame-sequence__dot forge-frame-sequence__dot--active" aria-label="Go to frame 1" aria-current="true"></button>',
      )
      expect(result).toContain(
        '<button type="button" class="forge-frame-sequence__dot" aria-label="Go to frame 2"></button>',
      )
    })

    it('should skip a malformed frame when its frontmatter never closes', () => {
      // Arrange
      const extension = new FrameSequenceExtension()
      const chunk = frameSequenceChunk(
        {},
        `:::frame
---
title: Never closes
The broken slide.
:::

:::frame
---
title: Persist answers
---
The good slide.
:::`,
      )

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain('<p class="forge-frame-sequence__eyebrow">Frame 1 of 1</p>')
      expect(result).toContain('Persist answers')
      expect(result).toContain(
        '<div class="forge-frame-sequence__frame" data-frame-index="0"><p>The good slide.</p></div>',
      )
      expect(result).not.toContain('Never closes')
      expect(result).not.toContain('The broken slide.')
    })

    it('should escape HTML when titles contain markup', () => {
      // Arrange
      const extension = new FrameSequenceExtension()
      const chunk = frameSequenceChunk(
        { title: 'Lifecycle of <Journey> & steps' },
        `:::frame
---
title: A <b>bold</b> frame
---
The slide.
:::`,
      )

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain('Lifecycle of &lt;Journey&gt; &amp; steps')
      expect(result).toContain('A &lt;b&gt;bold&lt;/b&gt; frame')
      expect(result).not.toContain('<b>bold</b>')
    })

    it('should fall back to plain markdown rendering when the body contains no frames', () => {
      // Arrange
      const extension = new FrameSequenceExtension()
      const chunk = frameSequenceChunk({ title: 'Journey lifecycle' }, 'Just some prose.')

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toBe('<p>Just some prose.</p>')
      expect(result).not.toContain('forge-frame-sequence')
    })
  })
})
