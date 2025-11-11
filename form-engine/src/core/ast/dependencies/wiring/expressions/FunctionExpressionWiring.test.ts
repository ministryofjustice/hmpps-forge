import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { FunctionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import FunctionExpressionWiring from './FunctionExpressionWiring'

describe('FunctionExpressionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: FunctionExpressionWiring

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
    wiring = new FunctionExpressionWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire arguments to FUNCTION expression', () => {
      // Arrange
      const arg1 = ASTTestFactory.reference(['answers', 'value'])
      const arg2 = ASTTestFactory.reference(['data', 'minValue'])
      const arg3 = ASTTestFactory.reference(['data', 'maxValue'])

      const transformerExpr = ASTTestFactory.expression(FunctionType.TRANSFORMER)
        .withProperty('functionName', 'clamp')
        .withProperty('arguments', [arg1, arg2, arg3])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([transformerExpr])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(arg1.id, transformerExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'arguments',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(arg2.id, transformerExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'arguments',
        index: 1,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(arg3.id, transformerExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'arguments',
        index: 2,
      })
    })

    it('should wire only AST node arguments and skip primitive values', () => {
      // Arrange
      const arg1 = ASTTestFactory.reference(['answers', 'text'])

      const transformerExpr = ASTTestFactory.expression(FunctionType.TRANSFORMER)
        .withProperty('functionName', 'replace')
        .withProperty('arguments', [arg1, 'old', 'new'])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([transformerExpr])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(arg1.id, transformerExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'arguments',
        index: 0,
      })
    })

    it('should wire nested function expressions', () => {
      // Arrange
      const innerArg = ASTTestFactory.reference(['answers', 'name'])
      const innerFunction = ASTTestFactory.expression(FunctionType.TRANSFORMER)
        .withProperty('functionName', 'lowercase')
        .withProperty('arguments', [innerArg])
        .build()

      const outerArg = ASTTestFactory.reference(['data', 'prefix'])
      const outerFunction = ASTTestFactory.expression(FunctionType.TRANSFORMER)
        .withProperty('functionName', 'concat')
        .withProperty('arguments', [outerArg, innerFunction])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([outerFunction, innerFunction, outerArg, innerArg])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(innerArg.id, innerFunction.id, DependencyEdgeType.DATA_FLOW, {
        property: 'arguments',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(outerArg.id, outerFunction.id, DependencyEdgeType.DATA_FLOW, {
        property: 'arguments',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(innerFunction.id, outerFunction.id, DependencyEdgeType.DATA_FLOW, {
        property: 'arguments',
        index: 1,
      })
    })
  })
})
