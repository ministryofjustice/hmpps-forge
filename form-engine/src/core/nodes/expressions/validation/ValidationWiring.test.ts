import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { PredicateType, ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ValidationASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import ValidationWiring from './ValidationWiring'

describe('ValidationWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: ValidationWiring

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
    wiring = new ValidationWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire `when` to validation node', () => {
      // Arrange
      const whenNode = ASTTestFactory.expression(PredicateType.TEST).build()

      const validationNode = ASTTestFactory.expression<ValidationASTNode>(ExpressionType.VALIDATION)
        .withProperty('when', whenNode)
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
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

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([validationNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })
  })
})
