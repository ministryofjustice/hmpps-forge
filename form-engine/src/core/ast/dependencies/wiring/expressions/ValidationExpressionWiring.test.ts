import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { LogicType, ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ValidationASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import ValidationExpressionWiring from './ValidationExpressionWiring'

describe('ValidationExpressionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: ValidationExpressionWiring

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
    wiring = new ValidationExpressionWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire `when` to validation node', () => {
      // Arrange
      const whenNode = ASTTestFactory.expression(LogicType.TEST).build()

      const validationNode = ASTTestFactory.expression<ValidationASTNode>(ExpressionType.VALIDATION)
        .withProperty('when', whenNode)
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([validationNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenNode.id, validationNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    })

    it('should skip wiring when `when` is not an AST node', () => {
      // Arrange
      const validationNode = ASTTestFactory.expression<ValidationASTNode>(ExpressionType.VALIDATION)
        .withProperty('when', true)
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([validationNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })
  })
})
