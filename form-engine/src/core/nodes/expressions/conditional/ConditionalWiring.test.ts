import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { PredicateType, ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { ConditionalASTNode } from '@form-engine/core/types/expressions.type'
import ConditionalWiring from './ConditionalWiring'

describe('ConditionalWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: ConditionalWiring

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
    wiring = new ConditionalWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire predicate, then, and else branches to conditional node', () => {
      // Arrange
      const predicateNode = ASTTestFactory.expression(PredicateType.TEST).build()
      const thenNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const elseNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const conditionalNode = ASTTestFactory.expression<ConditionalASTNode>(ExpressionType.CONDITIONAL)
        .withProperty('predicate', predicateNode)
        .withProperty('thenValue', thenNode)
        .withProperty('elseValue', elseNode)
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
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
      const predicateNode = ASTTestFactory.expression(PredicateType.TEST).build()

      const conditionalNode = ASTTestFactory.expression<ConditionalASTNode>(ExpressionType.CONDITIONAL)
        .withProperty('predicate', predicateNode)
        .withProperty('thenValue', 'literal-value')
        .withProperty('elseValue', 42)
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
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
