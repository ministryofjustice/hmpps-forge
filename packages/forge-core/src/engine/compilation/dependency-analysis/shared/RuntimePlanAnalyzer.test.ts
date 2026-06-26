import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import RuntimePlanAnalyzer from './RuntimePlanAnalyzer'

describe('RuntimePlanAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildStepRuntimePlan()', () => {
    it('should normalize the step path and merge static data from ancestors', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journeyNode = ASTTestFactory.journey()
        .withProperty('path', '/journey')
        .withProperty('data', { shared: 'journey', journeyOnly: true })
        .build()
      const stepNode = ASTTestFactory.step()
        .withPath('/step')
        .withProperty('data', { shared: 'step', stepOnly: true })
        .build()

      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      astNodeTree.addNode(journeyNode.id)
      astNodeTree.addNode(stepNode.id, journeyNode.id)

      const analyzer = new RuntimePlanAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.buildStepRuntimePlan(stepNode)

      // Assert
      expect(result).toEqual({
        stepId: stepNode.id,
        path: 'step',
        staticData: {
          shared: 'step',
          journeyOnly: true,
          stepOnly: true,
        },
      })
    })
  })

})
