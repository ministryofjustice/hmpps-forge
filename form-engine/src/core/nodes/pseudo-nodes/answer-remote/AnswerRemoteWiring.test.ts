import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType } from '@form-engine/form/types/enums'
import { AccessTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import AnswerRemoteWiring from './AnswerRemoteWiring'

describe('AnswerRemoteWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: AnswerRemoteWiring

  function createMockWiringContext(stepNode: StepASTNode): jest.Mocked<WiringContext> {
    return {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(undefined),
      },
      findReferenceNodes: jest.fn().mockReturnValue([]),
      findLastOnAccessTransitionFrom: jest.fn().mockReturnValue(undefined),
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
    wiring = new AnswerRemoteWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire onAccess transition to answer remote', () => {
      // Arrange
      const onAccessTrans = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode

      const step = ASTTestFactory.step().withProperty('onAccess', [onAccessTrans]).build()

      const answerRemote = ASTTestFactory.answerRemotePseudoNode('previousField')

      mockWiringContext = createMockWiringContext(step)
      wiring = new AnswerRemoteWiring(mockWiringContext)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_REMOTE)
        .mockReturnValue([answerRemote])

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([])

      when(mockWiringContext.findLastOnAccessTransitionFrom).calledWith(step.id).mockReturnValue(onAccessTrans)

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(onAccessTrans.id, answerRemote.id, DependencyEdgeType.DATA_FLOW, {
        fieldCode: 'previousField',
      })
    })

    it('should wire answer remote to Answer() reference consumers', () => {
      // Arrange
      const answerRemote = ASTTestFactory.answerRemotePseudoNode('previousField')
      const answerRef = ASTTestFactory.reference(['answers', 'previousField'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_REMOTE)
        .mockReturnValue([answerRemote])

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([answerRef])

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

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_REMOTE)
        .mockReturnValue([answerRemote])

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([answerRef])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(answerRemote.id, answerRef.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'answer',
        fieldCode: 'address',
      })
    })

    it('should handle no answer remote pseudo nodes', () => {
      // Arrange
      when(mockWiringContext.nodeRegistry.findByType).calledWith(PseudoNodeType.ANSWER_REMOTE).mockReturnValue([])

      // Act
      wiring.wire()

      // Assert - no edges created
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should not wire reference when reference path is too short', () => {
      // Arrange
      const answerRemote = ASTTestFactory.answerRemotePseudoNode('field')
      const invalidRef = ASTTestFactory.reference(['answers']) // Missing field name

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_REMOTE)
        .mockReturnValue([answerRemote])

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([invalidRef])

      // Act
      wiring.wire()

      // Assert - no edge to invalid reference
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should not wire reference when field code does not match', () => {
      // Arrange
      const answerRemote = ASTTestFactory.answerRemotePseudoNode('firstName')
      const differentFieldRef = ASTTestFactory.reference(['answers', 'lastName'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.ANSWER_REMOTE)
        .mockReturnValue([answerRemote])

      when(mockWiringContext.findReferenceNodes).calledWith('answers').mockReturnValue([differentFieldRef])

      // Act
      wiring.wire()

      // Assert - no edge to non-matching reference
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })
  })
})
