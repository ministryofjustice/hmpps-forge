import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import RouteMetadataInputAnalyzer from './RouteMetadataInputAnalyzer'

describe('RouteMetadataInputAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildInputs()', () => {
    it('should map a step node id, title, description and metadata', () => {
      // Arrange
      const stepNode = ASTTestFactory.step()
        .withPath('/step')
        .withTitle('Step title')
        .withDescription('Step description')
        .withProperty('metadata', { navGroup: 'account' })
        .build()
      const analyzer = new RouteMetadataInputAnalyzer()

      // Act
      const result = analyzer.buildInputs(stepNode)

      // Assert
      expect(result).toEqual({
        nodeId: stepNode.id,
        title: 'Step title',
        description: 'Step description',
        metadata: { navGroup: 'account' },
      })
    })

    it('should map a journey node id, title, description and metadata', () => {
      // Arrange
      const journeyNode = ASTTestFactory.journey()
        .withTitle('Journey title')
        .withProperty('description', 'Journey description')
        .withMetadata({ hiddenFromNav: true })
        .build()
      const analyzer = new RouteMetadataInputAnalyzer()

      // Act
      const result = analyzer.buildInputs(journeyNode)

      // Assert
      expect(result).toEqual({
        nodeId: journeyNode.id,
        title: 'Journey title',
        description: 'Journey description',
        metadata: { hiddenFromNav: true },
      })
    })

    it('should leave description and metadata undefined when the node omits them', () => {
      // Arrange
      const stepNode = ASTTestFactory.step().withPath('/step').withTitle('Only title').build()
      const analyzer = new RouteMetadataInputAnalyzer()

      // Act
      const result = analyzer.buildInputs(stepNode)

      // Assert
      expect(result.description).toBeUndefined()
      expect(result.metadata).toBeUndefined()
    })
  })
})
