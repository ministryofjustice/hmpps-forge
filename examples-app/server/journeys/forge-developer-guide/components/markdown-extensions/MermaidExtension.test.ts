import { describe, expect, it } from 'vitest'
import createMarkdownIt from 'markdown-it'
import { CodeBlockExtension } from './CodeBlockExtension'
import { MermaidExtension } from './MermaidExtension'

function createRenderer() {
  const markdownIt = createMarkdownIt()

  new CodeBlockExtension().registerPlugin(markdownIt)
  new MermaidExtension().registerPlugin(markdownIt)

  return markdownIt
}

describe('MermaidExtension', () => {
  describe('registerPlugin()', () => {
    it('should emit an escaped Mermaid source block for a Mermaid fence', () => {
      // Arrange
      const markdownIt = createRenderer()
      const markdown = `
\`\`\`mermaid
flowchart LR
  Answer{Eligible?} -->|Yes & ready| Continue[Continue]
\`\`\`
`

      // Act
      const result = markdownIt.render(markdown)

      // Assert
      expect(result).toContain('<div class="forge-mermaid"><pre class="mermaid">')
      expect(result).toContain('Answer{Eligible?} --&gt;|Yes &amp; ready| Continue[Continue]')
      expect(result).not.toContain('app-code-block')
    })

    it('should leave other fenced code blocks with the existing renderer', () => {
      // Arrange
      const markdownIt = createRenderer()
      const markdown = `
\`\`\`typescript
const answer = true
\`\`\`
`

      // Act
      const result = markdownIt.render(markdown)

      // Assert
      expect(result).toContain('<div class="app-code-block">')
      expect(result).toContain('language-typescript')
      expect(result).not.toContain('forge-mermaid')
    })
  })
})
