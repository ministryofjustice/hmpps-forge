import type MarkdownIt from 'markdown-it'
import createMarkdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import { beforeEach, describe, expect, it } from 'vitest'
import { CodeBlockExtension } from './CodeBlockExtension'
import { CodeStepExtension } from './CodeStepExtension'
import { GovUKStyleExtension } from './GovUKStyleExtension'

describe('CodeStepExtension', () => {
  describe('registerPlugin()', () => {
    let markdownIt: MarkdownIt

    beforeEach(() => {
      markdownIt = createMarkdownIt({ html: true, breaks: false, linkify: true })
      markdownIt.use(markdownItAttrs, {
        leftDelimiter: '{',
        rightDelimiter: '}',
        allowedAttributes: ['class', 'id', 'style'],
      })
      new GovUKStyleExtension().registerPlugin(markdownIt)
      new CodeBlockExtension().registerPlugin(markdownIt)
      new CodeStepExtension().registerPlugin(markdownIt)
    })

    it('should connect matching code and prose with the same colour group', () => {
      // Arrange
      const markdown = [
        '```typescript [[1, 1, "const connection"], [1, 2, "connection.connect();"], [2, 4, "connection.disconnect();"]]',
        'const connection = createConnection()',
        'connection.connect();',
        'return () => {',
        '  connection.disconnect();',
        '}',
        '```',
        '',
        'Use <s1>setup `code`</s1> and <s2>cleanup code</s2>.',
      ].join('\n')

      // Act
      const result = markdownIt.render(markdown)

      // Assert
      expect(result.match(/class="app-code-step app-code-step--1"/g)).toHaveLength(3)
      expect(result.match(/class="app-code-step app-code-step--2"/g)).toHaveLength(2)
      expect(result).toContain('<code>code</code>')
      expect(result).toContain('class="hljs-keyword"')
    })

    it('should support all ten colour groups', () => {
      // Arrange
      const markdown = Array.from(
        { length: 10 },
        (_, index) => `<s${index + 1}>group ${index + 1}</s${index + 1}>`,
      ).join(' ')

      // Act
      const result = markdownIt.render(markdown)

      // Assert
      Array.from({ length: 10 }, (_, index) => index + 1).forEach(step => {
        expect(result).toContain(`class="app-code-step app-code-step--${step}"`)
      })
    })

    it('should preserve syntax highlighting and escaped code within a code step', () => {
      // Arrange
      const markdown = [
        '```typescript [[1, 1, "<tag> & text"]]',
        "const value = '<tag> & text'",
        '```',
      ].join('\n')

      // Act
      const result = markdownIt.render(markdown)

      // Assert
      expect(result).toContain('class="hljs-string"')
      expect(result).toContain(
        '<span class="app-code-step app-code-step--1" data-step="1"><span class="hljs-string">&lt;tag&gt; &amp; text</span></span>',
      )
    })

    it('should use fromIndex to select repeated text later on a line', () => {
      // Arrange
      const markdown = ['```typescript [[1, 1, "value", 7]]', 'const value = value', '```'].join(
        '\n',
      )

      // Act
      const result = markdownIt.render(markdown)

      // Assert
      expect(result.indexOf('value')).toBeLessThan(result.indexOf('app-code-step--1'))
      expect(result.match(/class="app-code-step app-code-step--1"/g)).toHaveLength(1)
    })

    it('should throw when annotated text does not exist on the declared line', () => {
      // Arrange
      const markdown = ['```typescript [[1, 1, "missing"]]', 'const value = true', '```'].join('\n')

      // Act & Assert
      expect(() => markdownIt.render(markdown)).toThrow('Could not find "missing" on code line 1')
    })

    it('should throw when repeated text has no fromIndex', () => {
      // Arrange
      const markdown = ['```typescript [[1, 1, "value"]]', 'const value = value', '```'].join('\n')

      // Act & Assert
      expect(() => markdownIt.render(markdown)).toThrow(
        'Found "value" more than once on code line 1; provide fromIndex as the fourth tuple value',
      )
    })

    it('should throw when code-step annotations overlap', () => {
      // Arrange
      const markdown = [
        '```typescript [[1, 1, "connection.connect"], [2, 1, "connect()"]]',
        'connection.connect()',
        '```',
      ].join('\n')

      // Act & Assert
      expect(() => markdownIt.render(markdown)).toThrow('Code-step annotations cannot overlap')
    })

    it('should throw when a colour group is outside the supported range', () => {
      // Arrange
      const codeMarkdown = ['```typescript [[11, 1, "value"]]', 'const value = true', '```'].join(
        '\n',
      )

      // Act & Assert
      expect(() => markdownIt.render(codeMarkdown)).toThrow(
        'Code-step annotation 1 must use a step between 1 and 10',
      )
    })

    it('should throw when an inline code step is not closed', () => {
      // Arrange
      const markdown = '<s1>unclosed text'

      // Act & Assert
      expect(() => markdownIt.render(markdown)).toThrow(
        'Code step has an opening tag without a closing tag',
      )
    })

    it('should render text before and after an inline code step', () => {
      // Arrange
      const markdown = 'Before <s1>highlighted</s1> after.'

      // Act
      const result = markdownIt.render(markdown)

      // Assert
      expect(result).toContain('Before ')
      expect(result).toContain('app-code-step--1')
      expect(result).toContain('highlighted')
      expect(result).toContain(' after.')
    })
  })
})
