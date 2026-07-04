import { describe, it, expect, vi } from 'vitest'
import type {
  BlockDefinition,
  EvaluatedBlock,
  ComponentRegistryEntry,
} from '@ministryofjustice/hmpps-forge/core/components'
import type { RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'
import { StaticHtmlRenderer, FORGE_STATIC_BASE_PATH } from './StaticHtmlRenderer'

function htmlEntry(
  render: ComponentRegistryEntry<BlockDefinition, string>['render'],
): ComponentRegistryEntry<BlockDefinition, string> {
  return { variant: 'html', render }
}

const htmlBlock = { variant: 'html' } as EvaluatedBlock<BlockDefinition>

function renderContext(title?: string): RenderContext {
  return { step: { path: '/page', title } } as RenderContext
}

describe('StaticHtmlRenderer', () => {
  describe('renderBlock()', () => {
    it('should return the component HTML when the entry renders a string', () => {
      // Arrange
      const renderer = new StaticHtmlRenderer()
      const entry = htmlEntry(() => '<p>Hello</p>')

      // Act
      const result = renderer.renderBlock(entry, htmlBlock)

      // Assert
      expect(result).toBe('<p>Hello</p>')
    })

    it('should pass the configured rendererContext to the entry', () => {
      // Arrange
      const rendererContext = { locals: true }
      const render = vi.fn(() => '<p>Hello</p>')
      const renderer = new StaticHtmlRenderer({ rendererContext })

      // Act
      renderer.renderBlock(htmlEntry(render), htmlBlock)

      // Assert
      expect(render).toHaveBeenCalledWith(htmlBlock, rendererContext)
    })

    it('should throw when the entry does not render a string', () => {
      // Arrange
      const renderer = new StaticHtmlRenderer()
      const entry = htmlEntry(() => ({ not: 'a string' }) as never)

      // Act & Assert
      expect(() => renderer.renderBlock(entry, htmlBlock)).toThrow(
        'Component variant "html" must render an HTML string for the static site generator.',
      )
    })
  })

  describe('wrapNestedBlock()', () => {
    it('should wrap the output as a RenderedBlock carrying its html', () => {
      // Arrange
      const renderer = new StaticHtmlRenderer()
      const block = { variant: 'html' } as BlockDefinition

      // Act
      const result = renderer.wrapNestedBlock(block, '<p>Nested</p>')

      // Assert
      expect(result).toEqual({ block, html: '<p>Nested</p>' })
    })
  })

  describe('assemblePage()', () => {
    it('should pass the basePath from request state to the page function', () => {
      // Arrange
      const page = vi.fn(() => '<html></html>')
      const renderer = new StaticHtmlRenderer({ page })
      const context = renderContext('Page')

      // Act
      renderer.assemblePage(context, ['<p>Block</p>'], { [FORGE_STATIC_BASE_PATH]: '../..' })

      // Assert
      expect(page).toHaveBeenCalledWith({ context, blocks: ['<p>Block</p>'], basePath: '../..' })
    })

    it('should default the basePath to "." when request state has no base path', () => {
      // Arrange
      const page = vi.fn(() => '<html></html>')
      const renderer = new StaticHtmlRenderer({ page })

      // Act
      renderer.assemblePage(renderContext('Page'), [], {})

      // Assert
      expect(page).toHaveBeenCalledWith(expect.objectContaining({ basePath: '.' }))
    })

    it('should render the default page shell when no page function is provided', () => {
      // Arrange
      const renderer = new StaticHtmlRenderer()

      // Act
      const html = renderer.assemblePage(renderContext('Welcome'), ['<p>First</p>'], {})

      // Assert
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<title>Welcome</title>')
      expect(html).toContain('<h1>Welcome</h1>')
      expect(html).toContain('<p>First</p>')
    })

    it('should title the default page shell "Forge" when the step has no title', () => {
      // Arrange
      const renderer = new StaticHtmlRenderer()

      // Act
      const html = renderer.assemblePage(renderContext(), [], {})

      // Assert
      expect(html).toContain('<title>Forge</title>')
    })
  })
})
