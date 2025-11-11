import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { LogicType, ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ConditionalASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import ConditionalExpressionWiring from './ConditionalExpressionWiring'

describe('ConditionalExpressionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: ConditionalExpressionWiring

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
    wiring = new ConditionalExpressionWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire predicate, then, and else branches to conditional node', () => {
      // Arrange
      const predicateNode = ASTTestFactory.expression(LogicType.TEST).build()
      const thenNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const elseNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const conditionalNode = ASTTestFactory.expression<ConditionalASTNode>(LogicType.CONDITIONAL)
        .withProperty('predicate', predicateNode)
        .withProperty('thenValue', thenNode)
        .withProperty('elseValue', elseNode)
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([conditionalNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        predicateNode.id,
        conditionalNode.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'predicate',
        },
      )

      expect(mockGraph.addEdge).toHaveBeenCalledWith(thenNode.id, conditionalNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'thenValue',
      })

      expect(mockGraph.addEdge).toHaveBeenCalledWith(elseNode.id, conditionalNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'elseValue',
      })
    })

    it('should wire only AST node branches and skip literal values', () => {
      // Arrange
      const predicateNode = ASTTestFactory.expression(LogicType.TEST).build()

      const conditionalNode = ASTTestFactory.expression<ConditionalASTNode>(LogicType.CONDITIONAL)
        .withProperty('predicate', predicateNode)
        .withProperty('thenValue', 'literal-value')
        .withProperty('elseValue', 42)
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([conditionalNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        predicateNode.id,
        conditionalNode.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'predicate',
        },
      )
    })
  })
})
