import type { ASTNode } from '../../../contracts/ast/engine.type'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import RuntimePlanAnalyzer from './RuntimePlanAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('RuntimePlanAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildStepRuntimePlan()', () => {
    it('should normalize the step path', () => {
      // Arrange
      const stepNode = ASTTestFactory.step().withPath('/step').build()
      const analyzer = new RuntimePlanAnalyzer()

      // Act
      const result = analyzer.buildStepRuntimePlan(stepNode)

      // Assert
      expect(result).toEqual({
        stepId: stepNode.id,
        path: 'step',
      })
    })
  })

  describe('resolveStaticData()', () => {
    it('should merge static data from ancestors', () => {
      // Arrange
      const journeyNode = ASTTestFactory.journey()
        .withProperty('path', '/journey')
        .withProperty('data', { shared: 'journey', journeyOnly: true })
        .build()
      const stepNode = ASTTestFactory.step()
        .withPath('/step')
        .withProperty('data', { shared: 'step', stepOnly: true })
        .build()

      setParent(stepNode, journeyNode)

      const analyzer = new RuntimePlanAnalyzer()

      // Act
      const result = analyzer.resolveStaticData(stepNode)

      // Assert
      expect(result).toEqual({
        shared: 'step',
        journeyOnly: true,
        stepOnly: true,
      })
    })
  })
})
