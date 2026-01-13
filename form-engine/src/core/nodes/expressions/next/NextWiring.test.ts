import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { PredicateType, ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NextASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import NextWiring from './NextWiring'

describe('NextWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: NextWiring

  function createMockWiringContext(): jest.Mocked<WiringContext> {
    return {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
        get: jest.fn(),
      },
      graph: mockGraph,
    } as unknown as jest.Mocked<WiringContext>
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockWiringContext = createMockWiringContext()
    wiring = new NextWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire `when` to next node', () => {
      // Arrange
      const whenNode = ASTTestFactory.expression(PredicateType.TEST).build()

      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', 'step-2')
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([nextNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenNode.id, nextNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    })

    it('should wire `goto` to next node when goto is an AST node', () => {
      // Arrange
      const gotoNode = ASTTestFactory.reference(['data', 'nextStep'])

      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', gotoNode)
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([nextNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(gotoNode.id, nextNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'goto',
      })
    })

    it('should wire both `when` and `goto` when both are AST nodes', () => {
      // Arrange
      const whenNode = ASTTestFactory.expression(PredicateType.TEST).build()
      const gotoNode = ASTTestFactory.reference(['data', 'nextStep'])

      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode)
        .withProperty('goto', gotoNode)
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([nextNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenNode.id, nextNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(gotoNode.id, nextNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'goto',
      })
    })

    it('should skip wiring `when` when not specified', () => {
      // Arrange
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', 'step-2')
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([nextNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should skip wiring `goto` when it is a string', () => {
      // Arrange
      const nextNode = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', 'step-2')
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([nextNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should wire multiple next nodes', () => {
      // Arrange
      const whenNode1 = ASTTestFactory.expression(PredicateType.TEST).build()
      const whenNode2 = ASTTestFactory.expression(PredicateType.TEST).build()

      const nextNode1 = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode1)
        .withProperty('goto', 'step-2')
        .build()

      const nextNode2 = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('when', whenNode2)
        .withProperty('goto', 'step-3')
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([nextNode1, nextNode2])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenNode1.id, nextNode1.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenNode2.id, nextNode2.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    })
  })
})
