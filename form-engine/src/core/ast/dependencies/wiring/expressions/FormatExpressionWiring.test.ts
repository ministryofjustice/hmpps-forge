import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import FormatExpressionWiring from './FormatExpressionWiring'

describe('FormatExpressionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: FormatExpressionWiring

  function createMockWiringContext(): jest.Mocked<WiringContext> {
    return {
      findNodesByType: jest.fn().mockReturnValue([]),
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
    wiring = new FormatExpressionWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire arguments to FORMAT expression', () => {
      // Arrange
      const arg1 = ASTTestFactory.reference(['answers', 'firstName'])
      const arg2 = ASTTestFactory.reference(['answers', 'lastName'])
      const arg3 = ASTTestFactory.reference(['data', 'age'])

      const formatExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', '{0} {1} is {2} years old')
        .withProperty('args', [arg1, arg2, arg3])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([formatExpr])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(arg1.id, formatExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'args',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(arg2.id, formatExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'args',
        index: 1,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(arg3.id, formatExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'args',
        index: 2,
      })
    })

    it('should wire only AST node arguments and skip primitive values', () => {
      // Arrange
      const arg1 = ASTTestFactory.reference(['data', 'greeting'])
      const arg2 = ASTTestFactory.reference(['answers', 'name'])

      const formatExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', '{0} {1}! Age: {2}')
        .withProperty('args', [arg1, arg2, 25])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([formatExpr])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(arg1.id, formatExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'args',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(arg2.id, formatExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'args',
        index: 1,
      })
    })

    it('should wire nested format expressions', () => {
      // Arrange
      const innerArg = ASTTestFactory.reference(['answers', 'name'])
      const innerFormat = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', 'Hello {0}')
        .withProperty('args', [innerArg])
        .build()

      const outerArg = ASTTestFactory.reference(['data', 'title'])
      const outerFormat = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', '{0}: {1}')
        .withProperty('args', [outerArg, innerFormat])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([outerFormat, innerFormat, outerArg, innerArg])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(innerArg.id, innerFormat.id, DependencyEdgeType.DATA_FLOW, {
        property: 'args',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(outerArg.id, outerFormat.id, DependencyEdgeType.DATA_FLOW, {
        property: 'args',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(innerFormat.id, outerFormat.id, DependencyEdgeType.DATA_FLOW, {
        property: 'args',
        index: 1,
      })
    })
  })
})
