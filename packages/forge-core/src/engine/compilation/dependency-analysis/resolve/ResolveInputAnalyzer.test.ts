import type { ASTNode } from '../../../contracts/ast/engine.type'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'
import ResolveInputAnalyzer from './ResolveInputAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('ResolveInputAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildInputs()', () => {
    it('should return the step node and ancestor journeys', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()

      setParent(stepNode, journeyNode)
      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)

      const fieldInventoryAnalyzer = new FieldInventoryAnalyzer(nodeRegistry)
      const analyzer = new ResolveInputAnalyzer(fieldInventoryAnalyzer)

      // Act
      const result = analyzer.buildInputs(stepNode)

      // Assert
      expect(result.stepNode).toBe(stepNode)
      expect(result.ancestorJourneys).toEqual([journeyNode])
      expect(result.allIterateNodes).toEqual([])
    })
  })
})
