import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { PredicateType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import NotWiring from './NotWiring'

describe('NotWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: NotWiring

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
    wiring = new NotWiring(mockWiringContext)
  })

  describe('wire()', () => {
    it('should wire operand to NOT node', () => {
      // Arrange
      const operandNode = ASTTestFactory.predicate(PredicateType.TEST)

      const notNode = ASTTestFactory.predicate(PredicateType.NOT, {
        operand: operandNode,
      } as any)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([notNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(operandNode.id, notNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operand',
      })
    })

    it('should skip literal operand values', () => {
      // Arrange
      const notNode = ASTTestFactory.predicate(PredicateType.NOT, {
        operand: true,
      } as any)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([notNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should wire multiple NOT nodes', () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)

      const notNode1 = ASTTestFactory.predicate(PredicateType.NOT, {
        operand: operand1,
      } as any)

      const notNode2 = ASTTestFactory.predicate(PredicateType.NOT, {
        operand: operand2,
      } as any)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([notNode1, notNode2])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(operand1.id, notNode1.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operand',
      })

      expect(mockGraph.addEdge).toHaveBeenCalledWith(operand2.id, notNode2.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operand',
      })
    })
  })
})
