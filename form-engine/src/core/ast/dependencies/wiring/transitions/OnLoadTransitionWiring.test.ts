import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType, FunctionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { LoadTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import OnLoadTransitionWiring from './OnLoadTransitionWiring'

describe('OnLoadTransitionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: OnLoadTransitionWiring

  function createMockWiringContext(stepNode?: StepASTNode): jest.Mocked<WiringContext> {
    return {
      findNodesByType: jest.fn().mockReturnValue([]),
      getNodeDepth: jest.fn().mockReturnValue(0),
      metadataRegistry: {
        get: jest.fn().mockReturnValue(false),
      },
      graph: mockGraph,
      getStepNode: jest.fn().mockReturnValue(stepNode),
    } as unknown as jest.Mocked<WiringContext>
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockWiringContext = createMockWiringContext()
    wiring = new OnLoadTransitionWiring(mockWiringContext)
  })

  describe('wireSameDepthTransitions', () => {
    it('should wire transitions within a single journey', () => {
      // Arrange
      const transitionA = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const transitionB = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const transitionC = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const journey = ASTTestFactory.journey()
        .withProperty('onLoad', [transitionA, transitionB, transitionC])
        .build()

      const step = ASTTestFactory.step().build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([journey])

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(journey.id, 'isAncestorOfStep')
        .mockReturnValue(true)

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addNode).toHaveBeenCalledWith(transitionA.id)
      expect(mockGraph.addNode).toHaveBeenCalledWith(transitionB.id)
      expect(mockGraph.addNode).toHaveBeenCalledWith(transitionC.id)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(transitionA.id, transitionB.id, DependencyEdgeType.EFFECT_FLOW, {
        chain: 'onLoad',
        crossDepth: false,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(transitionB.id, transitionC.id, DependencyEdgeType.EFFECT_FLOW, {
        chain: 'onLoad',
        crossDepth: false,
      })
    })

    it('should wire transitions within step node', () => {
      // Arrange
      const transitionA = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const transitionB = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [transitionA, transitionB])
        .build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addNode).toHaveBeenCalledWith(transitionA.id)
      expect(mockGraph.addNode).toHaveBeenCalledWith(transitionB.id)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(transitionA.id, transitionB.id, DependencyEdgeType.EFFECT_FLOW, {
        chain: 'onLoad',
        crossDepth: false,
      })
    })

    it('should handle empty onLoad array', () => {
      // Arrange
      const journey = ASTTestFactory.journey()
        .withProperty('onLoad', [])
        .build()

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [])
        .build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([journey])

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(journey.id, 'isAncestorOfStep')
        .mockReturnValue(true)

      // Act
      wiring.wire()

      // Assert - no nodes or edges created
      expect(mockGraph.addNode).not.toHaveBeenCalled()
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should not wire journeys that are not ancestors of the step', () => {
      // Arrange
      const ancestorTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const unrelatedTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const ancestorJourney = ASTTestFactory.journey()
        .withProperty('onLoad', [ancestorTrans])
        .build()

      const unrelatedJourney = ASTTestFactory.journey()
        .withProperty('onLoad', [unrelatedTrans])
        .build()

      const step = ASTTestFactory.step().build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([ancestorJourney, unrelatedJourney])

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(ancestorJourney.id, 'isAncestorOfStep')
        .mockReturnValue(true)

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(unrelatedJourney.id, 'isAncestorOfStep')
        .mockReturnValue(false)

      // Act
      wiring.wire()

      // Assert - only ancestorTrans should be added, not unrelatedTrans
      expect(mockGraph.addNode).toHaveBeenCalledWith(ancestorTrans.id)
      expect(mockGraph.addNode).not.toHaveBeenCalledWith(unrelatedTrans.id)
    })
  })

  describe('wireCrossDepthTransitions', () => {
    it('should wire last transition of parent journey to first transition of child journey', () => {
      // Arrange
      const parentTransA = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const parentTransB = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const childTransA = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const childTransB = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const parentJourney = ASTTestFactory.journey()
        .withProperty('onLoad', [parentTransA, parentTransB])
        .build()

      const childJourney = ASTTestFactory.journey()
        .withProperty('onLoad', [childTransA, childTransB])
        .build()

      const step = ASTTestFactory.step().build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([parentJourney, childJourney])

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(parentJourney.id, 'isAncestorOfStep')
        .mockReturnValue(true)

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(childJourney.id, 'isAncestorOfStep')
        .mockReturnValue(true)

      // Mock depth: parent is depth 0, child is depth 1
      when(mockWiringContext.getNodeDepth)
        .calledWith(parentJourney.id)
        .mockReturnValue(0)

      when(mockWiringContext.getNodeDepth)
        .calledWith(childJourney.id)
        .mockReturnValue(1)

      // Act
      wiring.wire()

      // Assert - parentTransB → childTransA
      expect(mockGraph.addEdge).toHaveBeenCalledWith(parentTransB.id, childTransA.id, DependencyEdgeType.EFFECT_FLOW, {
        chain: 'onLoad',
        crossDepth: true,
      })
    })

    it('should wire last transition of deepest journey to first transition of step', () => {
      // Arrange
      const journeyTransA = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const journeyTransB = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const stepTransA = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const stepTransB = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const journey = ASTTestFactory.journey()
        .withProperty('onLoad', [journeyTransA, journeyTransB])
        .build()

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [stepTransA, stepTransB])
        .build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([journey])

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(journey.id, 'isAncestorOfStep')
        .mockReturnValue(true)

      // Act
      wiring.wire()

      // Assert - journeyTransB → stepTransA
      expect(mockGraph.addEdge).toHaveBeenCalledWith(journeyTransB.id, stepTransA.id, DependencyEdgeType.EFFECT_FLOW, {
        chain: 'onLoad',
        crossDepth: true,
      })
    })

    it('should wire three-level hierarchy correctly', () => {
      // Arrange
      const rootTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const middleTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const deepTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const stepTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const rootJourney = ASTTestFactory.journey()
        .withProperty('onLoad', [rootTrans])
        .build()

      const middleJourney = ASTTestFactory.journey()
        .withProperty('onLoad', [middleTrans])
        .build()

      const deepJourney = ASTTestFactory.journey()
        .withProperty('onLoad', [deepTrans])
        .build()

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [stepTrans])
        .build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([rootJourney, middleJourney, deepJourney])

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(rootJourney.id, 'isAncestorOfStep')
        .mockReturnValue(true)

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(middleJourney.id, 'isAncestorOfStep')
        .mockReturnValue(true)

      when(mockWiringContext.metadataRegistry.get)
        .calledWith(deepJourney.id, 'isAncestorOfStep')
        .mockReturnValue(true)

      // Mock depth: root = 0, middle = 1, deep = 2
      when(mockWiringContext.getNodeDepth)
        .calledWith(rootJourney.id)
        .mockReturnValue(0)

      when(mockWiringContext.getNodeDepth)
        .calledWith(middleJourney.id)
        .mockReturnValue(1)

      when(mockWiringContext.getNodeDepth)
        .calledWith(deepJourney.id)
        .mockReturnValue(2)

      // Act
      wiring.wire()

      // Assert - chain should be: root → middle → deep → step
      expect(mockGraph.addEdge).toHaveBeenCalledWith(rootTrans.id, middleTrans.id, DependencyEdgeType.EFFECT_FLOW, {
        chain: 'onLoad',
        crossDepth: true,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(middleTrans.id, deepTrans.id, DependencyEdgeType.EFFECT_FLOW, {
        chain: 'onLoad',
        crossDepth: true,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(deepTrans.id, stepTrans.id, DependencyEdgeType.EFFECT_FLOW, {
        chain: 'onLoad',
        crossDepth: true,
      })
    })
  })

  describe('wireTransitionEffects', () => {
    it('should wire effects to their parent transition', () => {
      // Arrange
      const effectA = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadData', [])
      const effectB = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'setContext', [])

      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [effectA, effectB])
        .build() as LoadTransitionASTNode

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [transition])
        .build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([])

      // Act
      wiring.wire()

      // Assert - effects should be wired to transition
      expect(mockGraph.addEdge).toHaveBeenCalledWith(effectA.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'effects',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(effectB.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'effects',
        index: 1,
      })
    })

    it('should wire effects with arguments to their parent transition', () => {
      // Arrange
      const queryArg = ASTTestFactory.reference(['query', 'postcode'])
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadData', [queryArg])

      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [effect])
        .build() as LoadTransitionASTNode

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [transition])
        .build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([])

      // Act
      wiring.wire()

      // Assert - effect should be wired to transition
      expect(mockGraph.addEdge).toHaveBeenCalledWith(effect.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'effects',
        index: 0,
      })
    })

    it('should handle transitions without effects', () => {
      // Arrange
      const transition = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [transition])
        .build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([])

      // Act
      wiring.wire()

      // Assert - transition node added but no effect edges
      expect(mockGraph.addNode).toHaveBeenCalledWith(transition.id)

      // Filter out only DATA_FLOW edges (which would be from effects)
      const dataFlowCalls = (mockGraph.addEdge as jest.Mock).mock.calls.filter(
        call => call[2] === DependencyEdgeType.DATA_FLOW,
      )
      expect(dataFlowCalls).toHaveLength(0)
    })

    it('should handle transitions with empty effects array', () => {
      // Arrange
      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [])
        .build() as LoadTransitionASTNode

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [transition])
        .build()

      mockWiringContext = createMockWiringContext(step)
      wiring = new OnLoadTransitionWiring(mockWiringContext)

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.JOURNEY)
        .mockReturnValue([])

      // Act
      wiring.wire()

      // Assert - transition node added but no effect edges
      expect(mockGraph.addNode).toHaveBeenCalledWith(transition.id)

      // Filter out only DATA_FLOW edges (which would be from effects)
      const dataFlowCalls = (mockGraph.addEdge as jest.Mock).mock.calls.filter(
        call => call[2] === DependencyEdgeType.DATA_FLOW,
      )
      expect(dataFlowCalls).toHaveLength(0)
    })
  })
})
