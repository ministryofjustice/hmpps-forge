import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { PredicateType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import OrWiring from './OrWiring'

describe('OrWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: OrWiring

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
    wiring = new OrWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire all operands to OR node', () => {
      // Arrange
      const operand1 = ASTTestFactory.expression(PredicateType.TEST).build()
      const operand2 = ASTTestFactory.expression(PredicateType.TEST).build()
      const operand3 = ASTTestFactory.expression(PredicateType.TEST).build()

      const orNode = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [operand1, operand2, operand3],
      })

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([orNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(operand1.id, orNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index: 0,
      })

      expect(mockGraph.addEdge).toHaveBeenCalledWith(operand2.id, orNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index: 1,
      })

      expect(mockGraph.addEdge).toHaveBeenCalledWith(operand3.id, orNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index: 2,
      })
    })

    it('should wire only AST node operands and skip literal values', () => {
      // Arrange
      const operand1 = ASTTestFactory.expression(PredicateType.TEST).build()

      const orNode = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [operand1, true, false] as any,
      })

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([orNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(operand1.id, orNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index: 0,
      })
    })
  })
})
