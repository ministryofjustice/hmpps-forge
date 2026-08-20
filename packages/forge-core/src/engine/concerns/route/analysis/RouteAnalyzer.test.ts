import { staticValue } from '../../../chassis/contracts/models/authoredValue.type'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import {
  createJourneyAnalysisContext,
  createStepAnalysisContext,
} from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import RouteAnalyzer from './RouteAnalyzer'

describe('RouteAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('analyzeStep()', () => {
    it('should map a step node id, title, description and metadata', () => {
      // Arrange
      const stepNode = ASTTestFactory.step()
        .withPath('/step')
        .withTitle('Step title')
        .withDescription('Step description')
        .withProperty('metadata', { navGroup: 'account' })
        .build()
      const analyzer = new RouteAnalyzer()

      // Act
      const result = analyzer.analyzeStep(createStepAnalysisContext({ stepNode }))

      // Assert
      expect(result).toEqual({
        nodeId: stepNode.id,
        title: staticValue('Step title'),
        description: staticValue('Step description'),
        metadata: staticValue({ navGroup: 'account' }),
      })
    })

    it('should leave description and metadata undefined when the node omits them', () => {
      // Arrange
      const stepNode = ASTTestFactory.step().withPath('/step').withTitle('Only title').build()
      const analyzer = new RouteAnalyzer()

      // Act
      const result = analyzer.analyzeStep(createStepAnalysisContext({ stepNode }))

      // Assert
      expect(result.description).toBeUndefined()
      expect(result.metadata).toBeUndefined()
    })
  })

  describe('analyzeJourney()', () => {
    it('should map a journey node id, title, description and metadata', () => {
      // Arrange
      const journeyNode = ASTTestFactory.journey()
        .withTitle('Journey title')
        .withProperty('description', 'Journey description')
        .withMetadata({ hiddenFromNav: true })
        .build()
      const analyzer = new RouteAnalyzer()

      // Act
      const result = analyzer.analyzeJourney(createJourneyAnalysisContext({ journeyNode }))

      // Assert
      expect(result).toEqual({
        nodeId: journeyNode.id,
        title: staticValue('Journey title'),
        description: staticValue('Journey description'),
        metadata: staticValue({ hiddenFromNav: true }),
      })
    })
  })
})
