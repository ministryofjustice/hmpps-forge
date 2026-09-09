import createMarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { NoteExtension } from './NoteExtension'
import type { ExtensionChunk } from './MarkdownExtension'

function noteChunk(attrs: Record<string, string>, body = 'An aside.'): ExtensionChunk {
  return { kind: 'extension', containerName: 'note', attrs, body, children: [] }
}

describe('NoteExtension', () => {
  describe('renderContainer()', () => {
    it('should render the label and the body when the block declares no attrs', () => {
      // Arrange
      const extension = new NoteExtension()
      const chunk = noteChunk({})

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain('<aside class="forge-note">')
      expect(result).toContain('<div class="forge-note__label">Note</div>')
      expect(result).toContain('<div class="forge-note__body"><p>An aside.</p></div>')
    })

    it('should render markdown in the body when the body uses formatting', () => {
      // Arrange
      const extension = new NoteExtension()
      const markdownIt = createMarkdownIt({ html: true, breaks: false, linkify: true })
      const chunk = noteChunk({}, 'Some **bold text** and `inline code`.')

      // Act
      const result = extension.renderContainer(chunk, body => markdownIt.render(body))

      // Assert
      expect(result).toContain('<strong>bold text</strong>')
      expect(result).toContain('<code>inline code</code>')
    })

    it('should ignore attrs when the frontmatter declares any', () => {
      // Arrange
      const extension = new NoteExtension()
      const chunk = noteChunk({ variant: 'heads-up', title: 'Worth knowing' })

      // Act
      const result = extension.renderContainer(chunk, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain('<aside class="forge-note">')
      expect(result).toContain('<div class="forge-note__label">Note</div>')
      expect(result).not.toContain('Worth knowing')
    })
  })
})
