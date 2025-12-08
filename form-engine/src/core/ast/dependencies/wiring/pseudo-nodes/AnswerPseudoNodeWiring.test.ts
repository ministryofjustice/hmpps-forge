import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType, ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import { LoadTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import AnswerPseudoNodeWiring from './AnswerPseudoNodeWiring'

describe('AnswerPseudoNodeWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: AnswerPseudoNodeWiring

  function createMockWiringContext(stepNode: StepASTNode): jest.Mocked<WiringContext> {
    return {
      findPseudoNodesByType: jest.fn().mockReturnValue([]),
      findPseudoNode: jest.fn().mockReturnValue(undefined),
      findReferenceNodes: jest.fn().mockReturnValue([]),
      findLastOnLoadTransitionFrom: jest.fn().mockReturnValue(undefined),
      nodeRegistry: {
        get: jest.fn().mockReturnValue(undefined),
      },
      graph: mockGraph,
      getCurrentStepNode: jest.fn().mockReturnValue(stepNode),
    } as unknown as jest.Mocked<WiringContext>
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockWiringContext = createMockWiringContext(ASTTestFactory.step().build())
    wiring = new AnswerPseudoNodeWiring(mockWiringContext)
  })

  describe('wire', () => {
    describe('ANSWER_LOCAL pseudo nodes', () => {
      it('should wire POST pseudo node to answer local when no formatPipeline exists', () => {
        // Arrange
        const fieldBlock = ASTTestFactory.block('TextInput', 'field')
          .withCode('firstName')
          .build()

        const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
        const postNode = ASTTestFactory.postPseudoNode('firstName')

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(fieldBlock.id)
          .mockReturnValue(fieldBlock)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'firstName')
          .mockReturnValue(postNode)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'firstName',
        })
      })

      it('should wire formatPipeline to answer local when formatPipeline exists', () => {
        // Arrange
        const pipelineExpr = ASTTestFactory.expression(ExpressionType.PIPELINE)
          .build()

        const fieldBlock = ASTTestFactory.block('TextInput', 'field')
          .withCode('firstName')
          .withProperty('formatPipeline', pipelineExpr)
          .build()

        const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(fieldBlock.id)
          .mockReturnValue(fieldBlock)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(pipelineExpr.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
          propertyName: 'formatPipeline',
          fieldCode: 'firstName',
        })
      })

      it('should wire defaultValue to answer local when defaultValue exists', () => {
        // Arrange
        const defaultValueExpr = ASTTestFactory.expression(FunctionType.GENERATOR)
          .build()

        const fieldBlock = ASTTestFactory.block('TextInput', 'field')
          .withCode('firstName')
          .withProperty('defaultValue', defaultValueExpr)
          .build()

        const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
        const postNode = ASTTestFactory.postPseudoNode('firstName')

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(fieldBlock.id)
          .mockReturnValue(fieldBlock)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'firstName')
          .mockReturnValue(postNode)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - should wire both POST and defaultValue
        expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'firstName',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(
          defaultValueExpr.id,
          answerLocal.id,
          DependencyEdgeType.DATA_FLOW,
          {
            propertyName: 'defaultValue',
            fieldCode: 'firstName',
          },
        )
      })

      it('should wire onLoad transition to answer local when onLoad exists in step', () => {
        // Arrange
        const onLoadTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

        const step = ASTTestFactory.step()
          .withProperty('onLoad', [onLoadTrans])
          .build()

        const fieldBlock = ASTTestFactory.block('TextInput', 'field')
          .withCode('firstName')
          .build()

        const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
        const postNode = ASTTestFactory.postPseudoNode('firstName')

        mockWiringContext = createMockWiringContext(step)
        wiring = new AnswerPseudoNodeWiring(mockWiringContext)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(fieldBlock.id)
          .mockReturnValue(fieldBlock)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'firstName')
          .mockReturnValue(postNode)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(onLoadTrans)

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(onLoadTrans.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'firstName',
        })
      })

      it('should wire onLoad transition to answer local when transition exists', () => {
        // Arrange
        const onLoadTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
        const step = ASTTestFactory.step().build()

        const fieldBlock = ASTTestFactory.block('TextInput', 'field')
          .withCode('firstName')
          .build()

        const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
        const postNode = ASTTestFactory.postPseudoNode('firstName')

        mockWiringContext = createMockWiringContext(step)
        wiring = new AnswerPseudoNodeWiring(mockWiringContext)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(fieldBlock.id)
          .mockReturnValue(fieldBlock)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'firstName')
          .mockReturnValue(postNode)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(onLoadTrans)

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(onLoadTrans.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'firstName',
        })
      })

      it('should call findLastOnLoadTransitionFrom with step ID to traverse hierarchy', () => {
        // Arrange
        const onLoadTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
        const step = ASTTestFactory.step().build()

        const fieldBlock = ASTTestFactory.block('TextInput', 'field')
          .withCode('firstName')
          .build()

        const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
        const postNode = ASTTestFactory.postPseudoNode('firstName')

        mockWiringContext = createMockWiringContext(step)
        wiring = new AnswerPseudoNodeWiring(mockWiringContext)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(fieldBlock.id)
          .mockReturnValue(fieldBlock)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'firstName')
          .mockReturnValue(postNode)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(onLoadTrans)

        // Act
        wiring.wire()

        // Assert - verify hierarchy traversal was initiated from step node
        expect(mockWiringContext.findLastOnLoadTransitionFrom).toHaveBeenCalledWith(step.id)
      })

      it('should not wire onLoad when findLastOnLoadTransitionFrom returns undefined', () => {
        // Arrange
        const step = ASTTestFactory.step().build()

        const fieldBlock = ASTTestFactory.block('TextInput', 'field')
          .withCode('firstName')
          .build()

        const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
        const postNode = ASTTestFactory.postPseudoNode('firstName')

        mockWiringContext = createMockWiringContext(step)
        wiring = new AnswerPseudoNodeWiring(mockWiringContext)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(fieldBlock.id)
          .mockReturnValue(fieldBlock)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'firstName')
          .mockReturnValue(postNode)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(undefined)

        // Act
        wiring.wire()

        // Assert - should only wire POST, not onLoad
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'firstName',
        })
      })

      it('should wire answer local to Answer() reference consumers', () => {
        // Arrange
        const fieldBlock = ASTTestFactory.block('TextInput', 'field')
          .withCode('firstName')
          .build()

        const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
        const postNode = ASTTestFactory.postPseudoNode('firstName')

        const answerRef = ASTTestFactory.reference(['answers', 'firstName'])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(fieldBlock.id)
          .mockReturnValue(fieldBlock)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'firstName')
          .mockReturnValue(postNode)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([answerRef])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(answerLocal.id, answerRef.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'answer',
          fieldCode: 'firstName',
        })
      })

      it('should handle multiple answer local nodes', () => {
        // Arrange
        const field1 = ASTTestFactory.block('TextInput', 'field').withCode('firstName').build()
        const field2 = ASTTestFactory.block('TextInput', 'field').withCode('lastName').build()

        const answerLocal1 = ASTTestFactory.answerLocalPseudoNode('firstName', field1.id)
        const answerLocal2 = ASTTestFactory.answerLocalPseudoNode('lastName', field2.id)

        const postNode1 = ASTTestFactory.postPseudoNode('firstName')
        const postNode2 = ASTTestFactory.postPseudoNode('lastName')

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal1, answerLocal2])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(field1.id)
          .mockReturnValue(field1)

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(field2.id)
          .mockReturnValue(field2)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'firstName')
          .mockReturnValue(postNode1)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'lastName')
          .mockReturnValue(postNode2)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode1.id, answerLocal1.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'firstName',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode2.id, answerLocal2.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'lastName',
        })
      })
    })

    describe('ANSWER_REMOTE pseudo nodes', () => {
      it('should wire onLoad transition to answer remote', () => {
        // Arrange
        const onLoadTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

        const step = ASTTestFactory.step()
          .withProperty('onLoad', [onLoadTrans])
          .build()

        const answerRemote = ASTTestFactory.answerRemotePseudoNode('previousField')

        mockWiringContext = createMockWiringContext(step)
        wiring = new AnswerPseudoNodeWiring(mockWiringContext)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([answerRemote])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(onLoadTrans)

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(onLoadTrans.id, answerRemote.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'previousField',
        })
      })

      it('should wire answer remote to Answer() reference consumers', () => {
        // Arrange
        const answerRemote = ASTTestFactory.answerRemotePseudoNode('previousField')
        const answerRef = ASTTestFactory.reference(['answers', 'previousField'])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([answerRemote])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([answerRef])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(answerRemote.id, answerRef.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'answer',
          fieldCode: 'previousField',
        })
      })

      it('should wire nested path to pseudo node', () => {
        // Arrange
        const answerRemote = ASTTestFactory.answerRemotePseudoNode('address')
        const answerRef = ASTTestFactory.reference(['answers', 'address', 'postcode'])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([answerRemote])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([answerRef])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(answerRemote.id, answerRef.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'answer',
          fieldCode: 'address',
        })
      })
    })

    describe('edge cases', () => {
      it('should handle no answer pseudo nodes', () => {
        // Arrange
        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - no edges created
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should not wire POST when POST pseudo node does not exist', () => {
        // Arrange
        const fieldBlock = ASTTestFactory.block('TextInput', 'field')
          .withCode('firstName')
          .build()

        const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([answerLocal])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([])

        when(mockWiringContext.nodeRegistry.get)
          .calledWith(fieldBlock.id)
          .mockReturnValue(fieldBlock)

        when(mockWiringContext.findPseudoNode)
          .calledWith(PseudoNodeType.POST, 'firstName')
          .mockReturnValue(undefined)

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - no POST edge created, but no error thrown
        const postEdgeCalls = (mockGraph.addEdge as jest.Mock).mock.calls.filter(
          call => call[3]?.fieldCode === 'firstName' && !call[3]?.propertyName,
        )
        expect(postEdgeCalls).toHaveLength(0)
      })

      it('should not wire reference when reference path is too short', () => {
        // Arrange
        const answerRemote = ASTTestFactory.answerRemotePseudoNode('field')
        const invalidRef = ASTTestFactory.reference(['answers']) // Missing field name

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([answerRemote])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([invalidRef])

        // Act
        wiring.wire()

        // Assert - no edge to invalid reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should not wire reference when field code does not match', () => {
        // Arrange
        const answerRemote = ASTTestFactory.answerRemotePseudoNode('firstName')
        const differentFieldRef = ASTTestFactory.reference(['answers', 'lastName'])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_LOCAL)
          .mockReturnValue([])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.ANSWER_REMOTE)
          .mockReturnValue([answerRemote])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('answers')
          .mockReturnValue([differentFieldRef])

        // Act
        wiring.wire()

        // Assert - no edge to non-matching reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })
    })
  })
})
