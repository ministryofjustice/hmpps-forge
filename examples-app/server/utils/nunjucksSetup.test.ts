import express from 'express'
import nunjucks from 'nunjucks'
import nunjucksSetup from './nunjucksSetup'

describe('nunjucksSetup', () => {
  describe('buildNavTree()', () => {
    interface NavNode {
      name?: string
      active: boolean
      children: NavNode[]
    }

    const buildNavTree = nunjucksSetup(express()).getFilter('buildNavTree') as (
      items: Record<string, unknown>[],
    ) => NavNode

    it('should mark every parent group active when a nested page is active', () => {
      // Arrange
      const items = [
        {
          active: true,
          metadata: { nav: 'Authoring API/References' },
        },
      ]

      // Act
      const result = buildNavTree(items)

      // Assert
      expect(result).toMatchObject({
        active: true,
        children: [
          {
            name: 'Authoring API',
            active: true,
            children: [{ name: 'References', active: true }],
          },
        ],
      })
    })
  })

  describe('injectAfterFirstH1()', () => {
    const injectAfterFirstH1 = nunjucksSetup(express()).getFilter('injectAfterFirstH1') as (
      block: unknown,
      htmlToInject: unknown,
    ) => string

    it('should insert the injection immediately after the first closing h1 tag', () => {
      // Arrange
      const block = '<h1>Title</h1><p>Body</p>'

      // Act
      const result = injectAfterFirstH1(block, '<div>chips</div>')

      // Assert
      expect(result).toBe('<h1>Title</h1><div>chips</div><p>Body</p>')
    })

    it('should prepend the injection when the block has no h1', () => {
      // Arrange
      const block = '<p>Body only</p>'

      // Act
      const result = injectAfterFirstH1(block, '<div>chips</div>')

      // Assert
      expect(result).toBe('<div>chips</div><p>Body only</p>')
    })

    it('should coerce a SafeString injection to a string before inserting it', () => {
      // Arrange
      const block = '<h1>Title</h1>'
      const injection = new nunjucks.runtime.SafeString('<div>chips</div>')

      // Act
      const result = injectAfterFirstH1(block, injection)

      // Assert
      expect(result).toBe('<h1>Title</h1><div>chips</div>')
    })
  })
})
