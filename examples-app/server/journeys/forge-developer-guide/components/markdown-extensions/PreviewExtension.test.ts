import { beforeEach, describe, expect, it } from 'vitest'
import { PreviewExtension } from './PreviewExtension'
import type { ExtensionChunk } from './MarkdownExtension'

describe('PreviewExtension', () => {
  let extension: PreviewExtension
  let chunk: ExtensionChunk

  beforeEach(() => {
    extension = new PreviewExtension()
    chunk = {
      kind: 'extension',
      containerName: 'preview',
      attrs: { slot: 'address-lookup-initial', title: 'Before lookup', caption: 'Find an address' },
      body: '',
      children: [],
    }
  })

  describe('renderContainer()', () => {
    it('should leave a Forge slot placeholder when rendering a preview', () => {
      // Arrange
      chunk.attrs.slot = 'address-lookup-results'

      // Act
      const result = extension.renderContainer(chunk)

      // Assert
      expect(result).toContain('<div data-forge-slot="address-lookup-results"></div>')
      expect(result).toContain('Before lookup')
      expect(result).toContain('Find an address')
      expect(result).not.toContain('<input')
    })

    it('should escape caption and title when they contain HTML', () => {
      // Arrange
      chunk.attrs.title = '<script>alert(1)</script>'
      chunk.attrs.caption = '<img src=x onerror="alert(1)">'

      // Act
      const result = extension.renderContainer(chunk)

      // Assert
      expect(result).toContain('&lt;script&gt;')
      expect(result).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
      expect(result).not.toContain('<script>')
    })

    it('should reject a slot when its name contains markup', () => {
      // Arrange
      chunk.attrs.slot = '"><script>'

      // Act
      const render = () => extension.renderContainer(chunk)

      // Assert
      expect(render).toThrow('A preview requires a slot name')
    })

    it('should reject a preview when its slot is missing', () => {
      // Arrange
      delete chunk.attrs.slot

      // Act
      const render = () => extension.renderContainer(chunk)

      // Assert
      expect(render).toThrow('A preview requires a slot name')
    })
  })
})
