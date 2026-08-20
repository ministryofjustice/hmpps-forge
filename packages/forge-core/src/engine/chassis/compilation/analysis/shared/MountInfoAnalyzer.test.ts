import type { ASTNode } from '../../../contracts/ast/engine.type'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import MountInfoAnalyzer from './MountInfoAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('MountInfoAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildStepMountInfo()', () => {
    it('should normalize the step path', () => {
      // Arrange
      const stepNode = ASTTestFactory.step().withPath('/step').build()
      const analyzer = new MountInfoAnalyzer()

      // Act
      const result = analyzer.buildStepMountInfo(stepNode)

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

      const analyzer = new MountInfoAnalyzer()

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
