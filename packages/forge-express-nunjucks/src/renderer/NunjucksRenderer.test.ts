import type { Environment } from 'nunjucks'
import NunjucksRenderer from './NunjucksRenderer'

describe('NunjucksRenderer', () => {
  let renderer: NunjucksRenderer

  beforeEach(() => {
    const nunjucksEnv = {
      getTemplate: vi.fn(),
    } as unknown as Environment

    renderer = new NunjucksRenderer({ nunjucksEnv })
  })

  describe('markBlock()', () => {
    it('should bracket the output with paired comment markers carrying the nodeId', () => {
      // Arrange
      const output = '<input type="text" />'

      // Act
      const marked = renderer.markBlock('compiled:template:90:0', output)

      // Assert
      expect(marked).toBe(
        '<!--forge:compiled:template:90:0--><input type="text" /><!--/forge:compiled:template:90:0-->',
      )
    })
  })
})
