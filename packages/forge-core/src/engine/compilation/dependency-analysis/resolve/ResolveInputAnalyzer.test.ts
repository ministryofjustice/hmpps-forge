import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'
import ResolveInputAnalyzer from './ResolveInputAnalyzer'

describe('ResolveInputAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildInputs()', () => {
    it('should return the step node and ancestor journeys', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()

      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      astNodeTree.addNode(journeyNode.id)
      astNodeTree.addNode(stepNode.id, journeyNode.id)

      const fieldInventoryAnalyzer = new FieldInventoryAnalyzer(nodeRegistry, astNodeTree)
      const analyzer = new ResolveInputAnalyzer(nodeRegistry, astNodeTree, fieldInventoryAnalyzer)

      // Act
      const result = analyzer.buildInputs(stepNode)

      // Assert
      expect(result.stepNode).toBe(stepNode)
      expect(result.ancestorJourneys).toEqual([journeyNode])
      expect(result.allIterateNodes).toEqual([])
    })
  })
})
