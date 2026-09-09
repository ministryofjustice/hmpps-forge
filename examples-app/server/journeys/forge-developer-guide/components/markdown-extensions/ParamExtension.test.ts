import { describe, expect, it } from 'vitest'
import { ParamExtension } from './ParamExtension'
import type { ContentChunk, ExtensionChunk } from './MarkdownExtension'

function paramChunk(attrs: Record<string, string>, body = 'A description.'): ExtensionChunk {
  return { kind: 'extension', containerName: 'param', attrs, body, children: [] }
}

describe('ParamExtension', () => {
  describe('transformChunks()', () => {
    it('should fold a param into its parent when it declares one', () => {
      // Arrange
      const extension = new ParamExtension()
      const parent = paramChunk({
        name: 'reachability',
        type: 'JourneyReachability',
        required: 'false',
      })
      const child = paramChunk({
        name: 'resumeWhen',
        parent: 'reachability',
        type: 'true | PredicateExpr',
        required: 'false',
      })

      // Act
      const result = extension.transformChunks([parent, child])

      // Assert
      expect(result).toEqual([parent])
      expect(parent.children).toEqual([child])
    })

    it('should nest into the nearest preceding parent when names repeat', () => {
      // Arrange
      const extension = new ParamExtension()
      const firstParent = paramChunk({ name: 'view', type: 'ViewConfig', required: 'false' })
      const secondParent = paramChunk({ name: 'view', type: 'StepViewConfig', required: 'false' })
      const child = paramChunk({
        name: 'template',
        parent: 'view',
        type: 'string',
        required: 'false',
      })

      // Act
      extension.transformChunks([firstParent, secondParent, child])

      // Assert
      expect(firstParent.children).toEqual([])
      expect(secondParent.children).toEqual([child])
    })

    it('should leave non-param chunks untouched', () => {
      // Arrange
      const extension = new ParamExtension()
      const markdownChunk: ContentChunk = { kind: 'markdown', content: '#### Heading' }
      const deepDiveChunk: ContentChunk = {
        kind: 'extension',
        containerName: 'deep-dive',
        attrs: {},
        body: 'Body.',
        children: [],
      }

      // Act
      const result = extension.transformChunks([markdownChunk, deepDiveChunk])

      // Assert
      expect(result).toEqual([markdownChunk, deepDiveChunk])
    })

    it('should throw when a param is missing its name', () => {
      // Arrange
      const extension = new ParamExtension()
      const chunk = paramChunk({ type: 'string', required: 'true' })

      // Act & Assert
      expect(() => extension.transformChunks([chunk])).toThrow(
        'A :::param block is missing "name" in its frontmatter',
      )
    })

    it('should throw when a param is missing its type', () => {
      // Arrange
      const extension = new ParamExtension()
      const chunk = paramChunk({ name: 'path', required: 'true' })

      // Act & Assert
      expect(() => extension.transformChunks([chunk])).toThrow(
        ':::param "path" is missing "type" in its frontmatter',
      )
    })

    it('should throw when required has a value other than true or false', () => {
      // Arrange
      const extension = new ParamExtension()
      const chunk = paramChunk({ name: 'path', type: 'string', required: 'yes' })

      // Act & Assert
      expect(() => extension.transformChunks([chunk])).toThrow(
        ':::param "path" must declare "required: true" or "required: false", got "yes"',
      )
    })

    it('should nest multiple levels deep when a parent is itself nested', () => {
      // Arrange
      const extension = new ParamExtension()
      const grandparent = paramChunk({ name: 'view', type: 'ViewConfig', required: 'false' })
      const parent = paramChunk({
        name: 'locals',
        parent: 'view',
        type: 'Record<string, unknown>',
        required: 'false',
      })
      const child = paramChunk({
        name: 'showBackToTop',
        parent: 'locals',
        type: 'boolean',
        required: 'false',
      })

      // Act
      const result = extension.transformChunks([grandparent, parent, child])

      // Assert
      expect(result).toEqual([grandparent])
      expect(grandparent.children).toEqual([parent])
      expect(parent.children).toEqual([child])
    })

    it('should throw when a parent name matches no earlier param', () => {
      // Arrange
      const extension = new ParamExtension()
      const child = paramChunk({
        name: 'resumeWhen',
        parent: 'reachability',
        type: 'boolean',
        required: 'false',
      })
      const laterParent = paramChunk({
        name: 'reachability',
        type: 'JourneyReachability',
        required: 'false',
      })

      // Act & Assert
      expect(() => extension.transformChunks([child, laterParent])).toThrow(
        ':::param "resumeWhen" names parent "reachability", but no earlier :::param has that name',
      )
    })
  })

  describe('renderContainer()', () => {
    it('should render nested children inside the parent wrapper', () => {
      // Arrange
      const extension = new ParamExtension()
      const parent = paramChunk({
        name: 'reachability',
        type: 'JourneyReachability',
        required: 'false',
      })
      const child = paramChunk({
        name: 'resumeWhen',
        parent: 'reachability',
        type: 'boolean',
        required: 'false',
      })
      parent.children.push(child)

      // Act
      const result = extension.renderContainer!(parent, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain('id="param-reachability"')
      expect(result).toContain('forge-param--nested')
      expect(result).toContain('id="param-reachability-resumeWhen"')
      expect(result.indexOf('param-reachability-resumeWhen')).toBeGreaterThan(
        result.indexOf('param-reachability'),
      )
      expect(result.endsWith('</div>')).toBe(true)
    })

    it('should compose anchor ids down the chain when nesting is multiple levels deep', () => {
      // Arrange
      const extension = new ParamExtension()
      const grandparent = paramChunk({ name: 'view', type: 'ViewConfig', required: 'false' })
      const parent = paramChunk({
        name: 'locals',
        parent: 'view',
        type: 'Record<string, unknown>',
        required: 'false',
      })
      const child = paramChunk({
        name: 'showBackToTop',
        parent: 'locals',
        type: 'boolean',
        required: 'false',
      })
      parent.children.push(child)
      grandparent.children.push(parent)

      // Act
      const result = extension.renderContainer!(grandparent, body => `<p>${body}</p>`)

      // Assert
      expect(result).toContain('id="param-view"')
      expect(result).toContain('id="param-view-locals"')
      expect(result).toContain('id="param-view-locals-showBackToTop"')
    })

    it('should render the body through the supplied markdown renderer', () => {
      // Arrange
      const extension = new ParamExtension()
      const chunk = paramChunk(
        { name: 'path', type: 'string', required: 'true' },
        'The route path.',
      )

      // Act
      const result = extension.renderContainer!(chunk, body => `<p class="rendered">${body}</p>`)

      // Assert
      expect(result).toContain('<p class="rendered">The route path.</p>')
    })
  })
})
