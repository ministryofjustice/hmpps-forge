import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { PredicateType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import AndWiring from './AndWiring'

describe('AndWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: AndWiring

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
    wiring = new AndWiring(mockWiringContext)
  })

  describe('wire()', () => {
    it('should wire operands array to AND expression', () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['answers', 'field1']),
      })

      const predicate2 = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['answers', 'field2']),
      })

      const andExpr = ASTTestFactory.expression(PredicateType.AND)
        .withProperty('operands', [predicate1, predicate2])
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([andExpr, predicate1, predicate2])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(predicate1.id, andExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index: 0,
      })

      expect(mockGraph.addEdge).toHaveBeenCalledWith(predicate2.id, andExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index: 1,
      })
    })

    it('should skip primitive operands in array', () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['answers', 'field1']),
      })

      const andExpr = ASTTestFactory.expression(PredicateType.AND)
        .withProperty('operands', [predicate1, true, 'literal'])
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([andExpr])

      // Act
      wiring.wire()

      // Assert - only AST node operand wired
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(predicate1.id, andExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index: 0,
      })
    })

    it('should handle empty operands array', () => {
      // Arrange
      const andExpr = ASTTestFactory.expression(PredicateType.AND)
        .withProperty('operands', [])
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([andExpr])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should not wire non-AND expressions', () => {
      // Arrange
      const orExpr = ASTTestFactory.expression(PredicateType.OR)
        .withProperty('operands', [])
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([orExpr])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })
  })
})
