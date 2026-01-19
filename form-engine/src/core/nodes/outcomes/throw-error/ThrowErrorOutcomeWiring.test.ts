import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { FunctionType, PredicateType } from '@form-engine/form/types/enums'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import ThrowErrorOutcomeWiring from './ThrowErrorOutcomeWiring'

describe('ThrowErrorOutcomeWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: ThrowErrorOutcomeWiring

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockWiringContext = {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
        get: jest.fn(),
      },
      graph: mockGraph,
    } as unknown as jest.Mocked<WiringContext>

    wiring = new ThrowErrorOutcomeWiring(mockWiringContext)
  })

  describe('wire()', () => {
    it('should wire when predicate to throw error outcome', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'notFound']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [true]),
        negate: false,
      })

      const throwErrorOutcome = ASTTestFactory.throwErrorOutcome({
        when: whenPredicate,
        status: 404,
        message: 'Not found',
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([throwErrorOutcome])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        whenPredicate.id,
        throwErrorOutcome.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'when',
        },
      )
    })

    it('should wire dynamic message to throw error outcome', () => {
      // Arrange
      const messageExpr = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Format', [
        'Resource not found: %1',
      ])

      const throwErrorOutcome = ASTTestFactory.throwErrorOutcome({
        status: 404,
        message: messageExpr,
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([throwErrorOutcome])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        messageExpr.id,
        throwErrorOutcome.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'message',
        },
      )
    })

    it('should not wire static string message', () => {
      // Arrange
      const throwErrorOutcome = ASTTestFactory.throwErrorOutcome({
        status: 403,
        message: 'Access denied',
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([throwErrorOutcome])

      // Act
      wiring.wire()

      // Assert - no message edge should be created for static string
      const messageEdges = (mockGraph.addEdge as jest.Mock).mock.calls.filter(call => call[3]?.property === 'message')
      expect(messageEdges).toHaveLength(0)
    })

    it('should wire both when and message when both are AST nodes', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'hasError']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [true]),
        negate: false,
      })

      const messageExpr = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Format', ['Error: %1'])

      const throwErrorOutcome = ASTTestFactory.throwErrorOutcome({
        when: whenPredicate,
        status: 500,
        message: messageExpr,
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([throwErrorOutcome])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        whenPredicate.id,
        throwErrorOutcome.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'when',
        },
      )
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        messageExpr.id,
        throwErrorOutcome.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'message',
        },
      )
    })

    it('should wire multiple throw error outcomes', () => {
      // Arrange
      const outcome1 = ASTTestFactory.throwErrorOutcome({ status: 404, message: 'Not found' })
      const messageExpr = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Format', ['Error: %1'])
      const outcome2 = ASTTestFactory.throwErrorOutcome({ status: 500, message: messageExpr })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([outcome1, outcome2])

      // Act
      wiring.wire()

      // Assert - only outcome2's message should be wired (outcome1 has static string)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(messageExpr.id, outcome2.id, DependencyEdgeType.DATA_FLOW, {
        property: 'message',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
    })

    it('should not wire non-throw-error outcomes', () => {
      // Arrange
      const redirectOutcome = ASTTestFactory.redirectOutcome({
        goto: '/path',
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([redirectOutcome])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })
  })

  describe('wireNodes()', () => {
    it('should wire only specified throw error outcome nodes', () => {
      // Arrange
      const messageExpr = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Format', ['Error: %1'])
      const throwErrorOutcome = ASTTestFactory.throwErrorOutcome({ status: 500, message: messageExpr })

      ;(mockWiringContext.nodeRegistry.get as jest.Mock).mockImplementation(id => {
        if (id === throwErrorOutcome.id) return throwErrorOutcome
        return undefined
      })

      // Act
      wiring.wireNodes([throwErrorOutcome.id])

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        messageExpr.id,
        throwErrorOutcome.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'message',
        },
      )
    })
  })
})
