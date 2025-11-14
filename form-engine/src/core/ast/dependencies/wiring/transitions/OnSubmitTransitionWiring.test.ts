import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType, FunctionType, LogicType, ExpressionType } from '@form-engine/form/types/enums'
import { SubmitTransitionASTNode, ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import { ASTNodeType } from '@form-engine/core/types/enums'
import OnSubmitTransitionWiring from './OnSubmitTransitionWiring'

describe('OnSubmitTransitionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let mockNodeRegistry: jest.Mocked<NodeRegistry>
  let wiring: OnSubmitTransitionWiring

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockNodeRegistry = {
      get: jest.fn(),
    } as unknown as jest.Mocked<NodeRegistry>

    mockWiringContext = {
      graph: mockGraph,
      findNodesByType: jest.fn(),
      nodeRegistry: mockNodeRegistry,
      getParentNode: jest.fn(),
      isDescendantOfStep: jest.fn(),
    } as unknown as jest.Mocked<WiringContext>

    wiring = new OnSubmitTransitionWiring(mockWiringContext)
  })

  describe('wire', () => {
    describe('basic transition registration', () => {
      it('should register all submit transition nodes', () => {
        // Arrange
        const transition1 = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
        const transition2 = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition1, transition2])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addNode).toHaveBeenCalledWith(transition1.id)
        expect(mockGraph.addNode).toHaveBeenCalledWith(transition2.id)
      })
    })

    describe('when predicate wiring', () => {
      it('should wire when predicate to transition', () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired', []) as any
        const whenPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'confirmed']),
          condition,
          negate: false,
        })
        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('when', whenPredicate)
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(whenPredicate.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'when',
        })
      })
    })

    describe('guards predicate wiring', () => {
      it('should wire guards predicate to transition', () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'matchesValue', ['admin']) as any
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'userRole']),
          condition,
          negate: false,
        })
        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('guards', guardsPredicate)
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(
          guardsPredicate.id,
          transition.id,
          DependencyEdgeType.DATA_FLOW,
          { property: 'guards' },
        )
      })
    })

    describe('validation dependencies', () => {
      it('should wire validations from parent step to transition when validate is true', () => {
        // Arrange
        const step = ASTTestFactory.step().build()
        const block = ASTTestFactory.block('TextInput', 'field').build()
        const validation1 = ASTTestFactory.expression(ExpressionType.VALIDATION).build()
        const validation2 = ASTTestFactory.expression(ExpressionType.VALIDATION).build()

        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('validate', true)
          .withProperty('onValid', { next: [] })
          .withProperty('onInvalid', { next: [] })
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([validation1, validation2] as ExpressionASTNode[])

        // Setup node registry mocks for parent traversal
        when(mockNodeRegistry.get).calledWith(transition.id).mockReturnValue(transition)
        when(mockNodeRegistry.get).calledWith(step.id).mockReturnValue(step)
        when(mockNodeRegistry.get).calledWith(block.id).mockReturnValue(block)
        when(mockNodeRegistry.get).calledWith(validation1.id).mockReturnValue(validation1)
        when(mockNodeRegistry.get).calledWith(validation2.id).mockReturnValue(validation2)

        // Mock parent chain: validation → block → step, transition → step
        mockWiringContext.getParentNode = jest.fn(nodeId => {
          if (nodeId === transition.id) return step
          if (nodeId === validation1.id) return block
          if (nodeId === validation2.id) return block
          if (nodeId === block.id) return step
          if (nodeId === step.id) return undefined
          return undefined
        }) as any

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(validation1.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'validations',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(validation2.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'validations',
        })
      })

      it('should not wire validations when validate is false', () => {
        // Arrange
        const validation = ASTTestFactory.expression(ExpressionType.VALIDATION).build()

        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('validate', false)
          .withProperty('onAlways', { next: [] })
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([validation] as ExpressionASTNode[])

        // Act
        wiring.wire()

        // Assert - no validation edges should be created
        const validationEdgeCalls = (mockGraph.addEdge as jest.Mock).mock.calls.filter(
          call => call[3]?.property === 'validations',
        )
        expect(validationEdgeCalls).toHaveLength(0)
      })
    })

    describe('ValidatingTransition (validate: true)', () => {
      it('should wire onAlways effects', () => {
        // Arrange
        const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'log', ['attempt'])

        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('validate', true)
          .withProperty('onAlways', { effects: [effect] })
          .withProperty('onValid', { next: [] })
          .withProperty('onInvalid', { next: [] })
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(effect.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onAlways.effects',
          index: 0,
        })
      })

      it('should wire onValid effects and next', () => {
        // Arrange
        const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'save', [])
        const next = ASTTestFactory.expression(ExpressionType.NEXT).build()

        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('validate', true)
          .withProperty('onValid', { effects: [effect], next: [next] })
          .withProperty('onInvalid', { next: [] })
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(effect.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onValid.effects',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(next.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onValid.next',
          index: 0,
        })
      })

      it('should wire onInvalid effects and next', () => {
        // Arrange
        const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logError', [])
        const next = ASTTestFactory.expression(ExpressionType.NEXT).build()

        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('validate', true)
          .withProperty('onValid', { next: [] })
          .withProperty('onInvalid', { effects: [effect], next: [next] })
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(effect.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onInvalid.effects',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(next.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onInvalid.next',
          index: 0,
        })
      })
    })

    describe('SkipValidationTransition (validate: false)', () => {
      it('should wire onAlways effects and next', () => {
        // Arrange
        const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'saveDraft', [])
        const next = ASTTestFactory.expression(ExpressionType.NEXT).build()

        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('validate', false)
          .withProperty('onAlways', { effects: [effect], next: [next] })
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(effect.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onAlways.effects',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(next.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onAlways.next',
          index: 0,
        })
      })

      it('should wire multiple effects and next expressions', () => {
        // Arrange
        const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'log', [])
        const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'saveDraft', [])
        const next1 = ASTTestFactory.expression(ExpressionType.NEXT).build()
        const next2 = ASTTestFactory.expression(ExpressionType.NEXT).build()

        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('validate', false)
          .withProperty('onAlways', { effects: [effect1, effect2], next: [next1, next2] })
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(effect1.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onAlways.effects',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(effect2.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onAlways.effects',
          index: 1,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(next1.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onAlways.next',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(next2.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onAlways.next',
          index: 1,
        })
      })
    })

    describe('edge cases', () => {
      it('should handle transitions without any properties', () => {
        // Arrange
        const transition = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - node should be added but no edges
        expect(mockGraph.addNode).toHaveBeenCalledWith(transition.id)
      })

      it('should handle empty effects arrays', () => {
        // Arrange
        const next = ASTTestFactory.expression(ExpressionType.NEXT).build()

        const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('validate', false)
          .withProperty('onAlways', { effects: [], next: [next] })
          .build() as SubmitTransitionASTNode

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.TRANSITION)
          .mockReturnValue([transition])

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - only next should be wired, no effects
        const effectEdgeCalls = (mockGraph.addEdge as jest.Mock).mock.calls.filter(call =>
          call[3]?.property?.includes('effects'),
        )
        expect(effectEdgeCalls).toHaveLength(0)

        expect(mockGraph.addEdge).toHaveBeenCalledWith(next.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'onAlways.next',
          index: 0,
        })
      })
    })
  })
})
