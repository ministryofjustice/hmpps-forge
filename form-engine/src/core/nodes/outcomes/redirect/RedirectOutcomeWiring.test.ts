import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { FunctionType, PredicateType } from '@form-engine/form/types/enums'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import RedirectOutcomeWiring from './RedirectOutcomeWiring'

describe('RedirectOutcomeWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: RedirectOutcomeWiring

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

    wiring = new RedirectOutcomeWiring(mockWiringContext)
  })

  describe('wire()', () => {
    it('should wire when predicate to redirect outcome', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'shouldRedirect']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [true]),
        negate: false,
      })

      const redirectOutcome = ASTTestFactory.redirectOutcome({
        when: whenPredicate,
        goto: '/dashboard',
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([redirectOutcome])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        whenPredicate.id,
        redirectOutcome.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'when',
        },
      )
    })

    it('should wire dynamic goto to redirect outcome', () => {
      // Arrange
      const gotoExpr = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Format', ['/user/%1'])

      const redirectOutcome = ASTTestFactory.redirectOutcome({
        goto: gotoExpr,
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([redirectOutcome])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(gotoExpr.id, redirectOutcome.id, DependencyEdgeType.DATA_FLOW, {
        property: 'goto',
      })
    })

    it('should not wire static string goto', () => {
      // Arrange
      const redirectOutcome = ASTTestFactory.redirectOutcome({
        goto: '/static-path',
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([redirectOutcome])

      // Act
      wiring.wire()

      // Assert - no goto edge should be created for static string
      const gotoEdges = (mockGraph.addEdge as jest.Mock).mock.calls.filter(call => call[3]?.property === 'goto')
      expect(gotoEdges).toHaveLength(0)
    })

    it('should wire both when and goto when both are AST nodes', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'isActive']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [true]),
        negate: false,
      })

      const gotoExpr = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Format', ['/profile/%1'])

      const redirectOutcome = ASTTestFactory.redirectOutcome({
        when: whenPredicate,
        goto: gotoExpr,
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([redirectOutcome])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        whenPredicate.id,
        redirectOutcome.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'when',
        },
      )
      expect(mockGraph.addEdge).toHaveBeenCalledWith(gotoExpr.id, redirectOutcome.id, DependencyEdgeType.DATA_FLOW, {
        property: 'goto',
      })
    })

    it('should wire multiple redirect outcomes', () => {
      // Arrange
      const outcome1 = ASTTestFactory.redirectOutcome({ goto: '/path1' })
      const gotoExpr = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Format', ['/path2'])
      const outcome2 = ASTTestFactory.redirectOutcome({ goto: gotoExpr })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([outcome1, outcome2])

      // Act
      wiring.wire()

      // Assert - only outcome2's goto should be wired (outcome1 has static string)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(gotoExpr.id, outcome2.id, DependencyEdgeType.DATA_FLOW, {
        property: 'goto',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
    })

    it('should not wire non-redirect outcomes', () => {
      // Arrange
      const throwErrorOutcome = ASTTestFactory.throwErrorOutcome({
        status: 404,
        message: 'Not found',
      })

      ;(mockWiringContext.nodeRegistry.findByType as jest.Mock).mockReturnValue([throwErrorOutcome])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })
  })

  describe('wireNodes()', () => {
    it('should wire only specified redirect outcome nodes', () => {
      // Arrange
      const gotoExpr = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Format', ['/user/%1'])
      const redirectOutcome = ASTTestFactory.redirectOutcome({ goto: gotoExpr })

      ;(mockWiringContext.nodeRegistry.get as jest.Mock).mockImplementation(id => {
        if (id === redirectOutcome.id) return redirectOutcome
        return undefined
      })

      // Act
      wiring.wireNodes([redirectOutcome.id])

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(gotoExpr.id, redirectOutcome.id, DependencyEdgeType.DATA_FLOW, {
        property: 'goto',
      })
    })
  })
})
