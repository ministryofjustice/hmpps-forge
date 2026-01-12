import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { BlockType, TransitionType, FunctionType } from '@form-engine/form/types/enums'
import { LoadTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import AnswerLocalWiring from './AnswerLocalWiring'

describe('AnswerLocalWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: AnswerLocalWiring

  function createMockWiringContext(stepNode: StepASTNode): jest.Mocked<WiringContext> {
    return {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(undefined),
      },
      findReferenceNodes: jest.fn().mockReturnValue([]),
      findLastOnLoadTransitionFrom: jest.fn().mockReturnValue(undefined),
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
    wiring = new AnswerLocalWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire POST pseudo node to answer local when no formatPipeline exists', () => {
      // Arrange
      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('firstName').build()

      const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
      const postNode = ASTTestFactory.postPseudoNode('firstName')

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_LOCAL)
        .mockReturnValue([answerLocal])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.nodeRegistry.get).calledWith(fieldBlock.id).mockReturnValue(fieldBlock)

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
        fieldCode: 'firstName',
      })
    })

    it('should wire formatters to answer local when formatters exist', () => {
      // Arrange
      const formatter1 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')
      const formatter2 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'toUpperCase')

      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('firstName')
        .withProperty('formatters', [formatter1, formatter2])
        .build()

      const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
      const postNode = ASTTestFactory.postPseudoNode('firstName')

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_LOCAL)
        .mockReturnValue([answerLocal])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.nodeRegistry.get).calledWith(fieldBlock.id).mockReturnValue(fieldBlock)

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([])

      // Act
      wiring.wire()

      // Assert - should wire POST and both formatters
      expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
        fieldCode: 'firstName',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(formatter1.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
        propertyName: 'formatters[0]',
        fieldCode: 'firstName',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(formatter2.id, answerLocal.id, DependencyEdgeType.DATA_FLOW, {
        propertyName: 'formatters[1]',
        fieldCode: 'firstName',
      })
    })

    it('should wire defaultValue to answer local when defaultValue exists', () => {
      // Arrange
      const defaultValueExpr = ASTTestFactory.expression(FunctionType.GENERATOR).build()

      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('firstName')
        .withProperty('defaultValue', defaultValueExpr)
        .build()

      const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
      const postNode = ASTTestFactory.postPseudoNode('firstName')

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_LOCAL)
        .mockReturnValue([answerLocal])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.nodeRegistry.get).calledWith(fieldBlock.id).mockReturnValue(fieldBlock)

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([])

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

      const step = ASTTestFactory.step().withProperty('onLoad', [onLoadTrans]).build()

      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('firstName').build()

      const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
      const postNode = ASTTestFactory.postPseudoNode('firstName')

      mockWiringContext = createMockWiringContext(step)
      wiring = new AnswerLocalWiring(mockWiringContext)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_LOCAL)
        .mockReturnValue([answerLocal])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.nodeRegistry.get).calledWith(fieldBlock.id).mockReturnValue(fieldBlock)

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([])

      when(mockWiringContext.findLastOnLoadTransitionFrom).calledWith(step.id).mockReturnValue(onLoadTrans)

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

      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('firstName').build()

      const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
      const postNode = ASTTestFactory.postPseudoNode('firstName')

      mockWiringContext = createMockWiringContext(step)
      wiring = new AnswerLocalWiring(mockWiringContext)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_LOCAL)
        .mockReturnValue([answerLocal])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.nodeRegistry.get).calledWith(fieldBlock.id).mockReturnValue(fieldBlock)

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([])

      when(mockWiringContext.findLastOnLoadTransitionFrom).calledWith(step.id).mockReturnValue(onLoadTrans)

      // Act
      wiring.wire()

      // Assert - verify hierarchy traversal was initiated from step node
      expect(mockWiringContext.findLastOnLoadTransitionFrom).toHaveBeenCalledWith(step.id)
    })

    it('should not wire onLoad when findLastOnLoadTransitionFrom returns undefined', () => {
      // Arrange
      const step = ASTTestFactory.step().build()

      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('firstName').build()

      const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
      const postNode = ASTTestFactory.postPseudoNode('firstName')

      mockWiringContext = createMockWiringContext(step)
      wiring = new AnswerLocalWiring(mockWiringContext)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_LOCAL)
        .mockReturnValue([answerLocal])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.nodeRegistry.get).calledWith(fieldBlock.id).mockReturnValue(fieldBlock)

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([])

      when(mockWiringContext.findLastOnLoadTransitionFrom).calledWith(step.id).mockReturnValue(undefined)

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
      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('firstName').build()

      const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
      const postNode = ASTTestFactory.postPseudoNode('firstName')

      const answerRef = ASTTestFactory.reference(['answers', 'firstName'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_LOCAL)
        .mockReturnValue([answerLocal])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.nodeRegistry.get).calledWith(fieldBlock.id).mockReturnValue(fieldBlock)

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([answerRef])

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
      const field1 = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('firstName').build()
      const field2 = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('lastName').build()

      const answerLocal1 = ASTTestFactory.answerLocalPseudoNode('firstName', field1.id)
      const answerLocal2 = ASTTestFactory.answerLocalPseudoNode('lastName', field2.id)

      const postNode1 = ASTTestFactory.postPseudoNode('firstName')
      const postNode2 = ASTTestFactory.postPseudoNode('lastName')

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_LOCAL)
        .mockReturnValue([answerLocal1, answerLocal2])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode1, postNode2])

      when(mockWiringContext.nodeRegistry.get).calledWith(field1.id).mockReturnValue(field1)

      when(mockWiringContext.nodeRegistry.get).calledWith(field2.id).mockReturnValue(field2)

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([])

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

    it('should handle no answer local pseudo nodes', () => {
      // Arrange
      when(mockWiringContext.nodeRegistry.findByType).calledWith(PseudoNodeType.ANSWER_LOCAL).mockReturnValue([])

      // Act
      wiring.wire()

      // Assert - no edges created
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should not wire POST when POST pseudo node does not exist', () => {
      // Arrange
      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('firstName').build()

      const answerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_LOCAL)
        .mockReturnValue([answerLocal])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([])

      when(mockWiringContext.nodeRegistry.get).calledWith(fieldBlock.id).mockReturnValue(fieldBlock)

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([])

      // Act
      wiring.wire()

      // Assert - no POST edge created, but no error thrown
      const postEdgeCalls = (mockGraph.addEdge as jest.Mock).mock.calls.filter(
        call => call[3]?.fieldCode === 'firstName' && !call[3]?.propertyName,
      )
      expect(postEdgeCalls).toHaveLength(0)
    })
  })
})
