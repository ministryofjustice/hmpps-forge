import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType, FunctionType, PredicateType, ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { AccessTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import AccessWiring from './AccessWiring'

describe('AccessWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: AccessWiring

  function createMockWiringContext(): jest.Mocked<WiringContext> {
    return {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
        get: jest.fn(),
      },
      metadataRegistry: {
        get: jest.fn().mockReturnValue(false),
      },
      graph: mockGraph,
      getCurrentStepNode: jest.fn().mockReturnValue({
        id: 'compile_ast:step',
        type: ASTNodeType.STEP,
        properties: {
          onAccess: [],
        },
      }),
      getNodeDepth: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<WiringContext>
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockWiringContext = createMockWiringContext()
    wiring = new AccessWiring(mockWiringContext)
  })

  describe('wire()', () => {
    it('should add access transition nodes to the graph', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'isAuthorized']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [false]),
        negate: false,
      })

      const transition = ASTTestFactory.transition(TransitionType.ACCESS)
        .withProperty('when', whenPredicate)
        .build() as AccessTransitionASTNode

      ;(mockWiringContext.getCurrentStepNode as jest.Mock).mockReturnValue({
        id: 'compile_ast:1',
        type: ASTNodeType.STEP,
        properties: { onAccess: [transition] },
      })

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addNode).toHaveBeenCalledWith(transition.id)
    })

    it('should wire when predicate to transition', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'hasPermission']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [false]),
        negate: false,
      })

      const transition = ASTTestFactory.transition(TransitionType.ACCESS)
        .withProperty('when', whenPredicate)
        .build() as AccessTransitionASTNode

      ;(mockWiringContext.getCurrentStepNode as jest.Mock).mockReturnValue({
        id: 'compile_ast:1',
        type: ASTNodeType.STEP,
        properties: { onAccess: [transition] },
      })

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(whenPredicate.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    })

    it('should wire effects to transition', () => {
      // Arrange
      const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logAccess', [])
      const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'trackVisit', [])

      const transition = ASTTestFactory.transition(TransitionType.ACCESS)
        .withProperty('effects', [effect1, effect2])
        .build() as AccessTransitionASTNode

      ;(mockWiringContext.getCurrentStepNode as jest.Mock).mockReturnValue({
        id: 'compile_ast:1',
        type: ASTNodeType.STEP,
        properties: { onAccess: [transition] },
      })

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(effect1.id, effect2.id, DependencyEdgeType.CONTROL_FLOW, {
        chain: 'effects',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(effect2.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'effects',
      })
    })

    it('should wire redirect expressions to transition', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'isBlocked']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [true]),
        negate: false,
      })

      const redirect1 = ASTTestFactory.expression(ExpressionType.NEXT)
        .withProperty('path', '/unauthorized')
        .build()
      const redirect2 = ASTTestFactory.expression(ExpressionType.NEXT)
        .withProperty('path', '/login')
        .build()

      const transition = ASTTestFactory.transition(TransitionType.ACCESS)
        .withProperty('when', whenPredicate)
        .withProperty('redirect', [redirect1, redirect2])
        .build() as AccessTransitionASTNode

      ;(mockWiringContext.getCurrentStepNode as jest.Mock).mockReturnValue({
        id: 'compile_ast:1',
        type: ASTNodeType.STEP,
        properties: { onAccess: [transition] },
      })

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(redirect1.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'redirect',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(redirect2.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'redirect',
        index: 1,
      })
    })

    it('should wire message expression to transition for error responses', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'notFound']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [true]),
        negate: false,
      })

      const messageExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', 'Resource not found: {id}')
        .build()

      const transition = ASTTestFactory.transition(TransitionType.ACCESS)
        .withProperty('when', whenPredicate)
        .withProperty('status', 404)
        .withProperty('message', messageExpr)
        .build() as AccessTransitionASTNode

      ;(mockWiringContext.getCurrentStepNode as jest.Mock).mockReturnValue({
        id: 'compile_ast:1',
        type: ASTNodeType.STEP,
        properties: { onAccess: [transition] },
      })

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(messageExpr.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'message',
      })
    })

    it('should not wire message when it is a static string', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'forbidden']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [true]),
        negate: false,
      })

      const transition = ASTTestFactory.transition(TransitionType.ACCESS)
        .withProperty('when', whenPredicate)
        .withProperty('status', 403)
        .withProperty('message', 'Access denied')
        .build() as AccessTransitionASTNode

      ;(mockWiringContext.getCurrentStepNode as jest.Mock).mockReturnValue({
        id: 'compile_ast:1',
        type: ASTNodeType.STEP,
        properties: { onAccess: [transition] },
      })

      // Act
      wiring.wire()

      // Assert - no message edge should be created for static string
      const messageEdges = (mockGraph.addEdge as jest.Mock).mock.calls.filter(call => call[3]?.property === 'message')
      expect(messageEdges).toHaveLength(0)
    })

    it('should wire multiple access transitions independently', () => {
      // Arrange
      const when1 = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'isAdmin']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [false]),
        negate: false,
      })

      const when2 = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'isVerified']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [false]),
        negate: false,
      })

      const transition1 = ASTTestFactory.transition(TransitionType.ACCESS)
        .withProperty('when', when1)
        .build() as AccessTransitionASTNode

      const transition2 = ASTTestFactory.transition(TransitionType.ACCESS)
        .withProperty('when', when2)
        .build() as AccessTransitionASTNode

      ;(mockWiringContext.getCurrentStepNode as jest.Mock).mockReturnValue({
        id: 'compile_ast:1',
        type: ASTNodeType.STEP,
        properties: { onAccess: [transition1, transition2] },
      })

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addNode).toHaveBeenCalledWith(transition1.id)
      expect(mockGraph.addNode).toHaveBeenCalledWith(transition2.id)

      expect(mockGraph.addEdge).toHaveBeenCalledWith(when1.id, transition1.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(when2.id, transition2.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    })

    it('should handle access transition with empty effects array', () => {
      // Arrange
      const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'isBlocked']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [true]),
        negate: false,
      })

      const transition = ASTTestFactory.transition(TransitionType.ACCESS)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [])
        .build() as AccessTransitionASTNode

      ;(mockWiringContext.getCurrentStepNode as jest.Mock).mockReturnValue({
        id: 'compile_ast:1',
        type: ASTNodeType.STEP,
        properties: { onAccess: [transition] },
      })

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

    it('should not wire non-access transitions', () => {
      // Arrange

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addNode).not.toHaveBeenCalled()
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should handle no access transitions in registry', () => {
      // Arrange

      // Act
      wiring.wire()

      // Assert - no nodes or edges added
      expect(mockGraph.addNode).not.toHaveBeenCalled()
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })
  })
})
