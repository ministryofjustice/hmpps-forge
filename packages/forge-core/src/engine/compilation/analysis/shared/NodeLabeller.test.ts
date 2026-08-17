import NodeLabeller from './NodeLabeller'

describe('NodeLabeller', () => {
  describe('labelFrom()', () => {
    it('should join the journey and step segments when both are identity segments', () => {
      // Arrange
      const node = { diagnostics: { source: { formattedPath: 'dump > form > blocks[1] (govukInsetText)' } } }

      // Act
      const label = new NodeLabeller().labelFrom([node])

      // Assert
      expect(label).toBe('dump.form')
    })

    it('should keep every ancestor segment when journeys nest', () => {
      // Arrange
      const node = { diagnostics: { source: { formattedPath: 'guide > building-journeys > defining-steps' } } }

      // Act
      const label = new NodeLabeller().labelFrom([node])

      // Assert
      expect(label).toBe('guide.building-journeys.defining-steps')
    })

    it('should stop at the first structural segment when the node sits on the journey', () => {
      // Arrange
      const node = { diagnostics: { source: { formattedPath: 'dump > onAccess[0] > effects[0]' } } }

      // Act
      const label = new NodeLabeller().labelFrom([node])

      // Assert
      expect(label).toBe('dump')
    })

    it('should take only the journey segment when maxDepth is 1', () => {
      // Arrange
      const node = { diagnostics: { source: { formattedPath: 'dump > form > blocks[0]' } } }

      // Act
      const label = new NodeLabeller().labelFrom([node], { maxDepth: 1 })

      // Assert
      expect(label).toBe('dump')
    })

    it('should use the first node carrying diagnostics when earlier nodes have none', () => {
      // Arrange
      const bare = {}
      const node = { diagnostics: { source: { formattedPath: 'dump > form' } } }

      // Act
      const label = new NodeLabeller().labelFrom([undefined, bare, node])

      // Assert
      expect(label).toBe('dump.form')
    })

    it('should return undefined when no node carries diagnostics', () => {
      // Act
      const label = new NodeLabeller().labelFrom([{}, undefined])

      // Assert
      expect(label).toBeUndefined()
    })
  })
})
