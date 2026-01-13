import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType, FunctionType, PredicateType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ActionTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import ActionWiring from './ActionWiring'

describe('ActionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: ActionWiring

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
    wiring = new ActionWiring(mockWiringContext)
  })

  describe('wire()', () => {
    it('should add action transition nodes to the graph', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['post', 'action']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['lookup']),
        negate: false,
      })

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [])
        .build() as ActionTransitionASTNode

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.TRANSITION)
        .mockReturnValue([transition])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addNode).toHaveBeenCalledWith(transition.id)
    })

    it('should wire when predicate to transition', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['post', 'button']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['find-address']),
        negate: false,
      })

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [])
        .build() as ActionTransitionASTNode

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.TRANSITION)
        .mockReturnValue([transition])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenPredicate.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    })

    it('should wire effects to transition', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['post', 'action']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['lookup']),
        negate: false,
      })

      const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'lookupPostcode', [])
      const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'populateAddress', [])

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [effect1, effect2])
        .build() as ActionTransitionASTNode

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.TRANSITION)
        .mockReturnValue([transition])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(effect1.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'effects',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(effect2.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'effects',
        index: 1,
      })
    })

    it('should wire multiple action transitions independently', () => {
      // Arrange
      const whenPredicate1 = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['post', 'action']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['lookup']),
        negate: false,
      })

      const whenPredicate2 = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['post', 'action']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['add-item']),
        negate: false,
      })

      const transition1 = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate1)
        .withProperty('effects', [])
        .build() as ActionTransitionASTNode

      const transition2 = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate2)
        .withProperty('effects', [])
        .build() as ActionTransitionASTNode

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.TRANSITION)
        .mockReturnValue([transition1, transition2])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addNode).toHaveBeenCalledWith(transition1.id)
      expect(mockGraph.addNode).toHaveBeenCalledWith(transition2.id)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenPredicate1.id, transition1.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenPredicate2.id, transition2.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    })

    it('should handle action transition with empty effects array', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['post', 'action']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['noop']),
        negate: false,
      })

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [])
        .build() as ActionTransitionASTNode

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.TRANSITION)
        .mockReturnValue([transition])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addNode).toHaveBeenCalledWith(transition.id)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenPredicate.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })

      // No effect edges should be created
      const effectEdges = (mockGraph.addEdge as jest.Mock).mock.calls.filter(call => call[3]?.property === 'effects')
      expect(effectEdges).toHaveLength(0)
    })

    it('should not wire non-action transitions', () => {
      // Arrange
      const loadTransition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [])
        .build()

      const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', false)
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.TRANSITION)
        .mockReturnValue([loadTransition, submitTransition])

      // Act
      wiring.wire()

      // Assert - no nodes or edges added
      expect(mockGraph.addNode).not.toHaveBeenCalled()
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should handle no action transitions in registry', () => {
      // Arrange
      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.TRANSITION)
        .mockReturnValue([])

      // Act
      wiring.wire()

      // Assert - no nodes or edges added
      expect(mockGraph.addNode).not.toHaveBeenCalled()
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })
  })
})
