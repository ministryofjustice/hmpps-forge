import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import AnswerPreparer from './AnswerPreparer'

function createRuntimePlan(options: Partial<StepRuntimePlan> = {}): StepRuntimePlan {
  return {
    stepId: 'compile_ast:1',
    accessAncestorIds: ['compile_ast:1'],
    actionTransitionIds: [],
    submitTransitionIds: [],
    fieldIteratorRootIds: [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    renderAncestorIds: [],
    renderStepId: 'compile_ast:1',
    isRenderSync: false,
    isAnswerPrepareSync: false,
    isValidationSync: false,
    hasValidatingSubmitTransition: false,
    ...options,
  }
}

describe('AnswerPreparer', () => {
  let preparer: AnswerPreparer
  let context: jest.Mocked<ThunkEvaluationContext>
  let invoker: jest.Mocked<ThunkInvocationAdapter>

  beforeEach(() => {
    ASTTestFactory.resetIds()
    preparer = new AnswerPreparer()
    context = {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
      },
    } as unknown as jest.Mocked<ThunkEvaluationContext>
    invoker = {
      invoke: jest.fn().mockResolvedValue({ value: undefined, metadata: { source: 'test', timestamp: Date.now() } }),
      invokeSync: jest.fn(),
    } as unknown as jest.Mocked<ThunkInvocationAdapter>
  })

  describe('prepare()', () => {
    it('should evaluate answer pseudo nodes when there are no field iterators', async () => {
      // Arrange
      const localAnswerNode = ASTTestFactory.answerLocalPseudoNode('field-1')
      const remoteAnswerNode = ASTTestFactory.answerRemotePseudoNode('field-2')
      const runtimePlan = createRuntimePlan()

      context.nodeRegistry.findByType = jest.fn().mockImplementation((type: string) => {
        if (type === PseudoNodeType.ANSWER_LOCAL) {
          return [localAnswerNode]
        }

        if (type === PseudoNodeType.ANSWER_REMOTE) {
          return [remoteAnswerNode]
        }

        return []
      })

      // Act
      await preparer.prepare(runtimePlan, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
      expect(invoker.invoke).toHaveBeenNthCalledWith(1, localAnswerNode.id, context)
      expect(invoker.invoke).toHaveBeenNthCalledWith(2, remoteAnswerNode.id, context)
    })

    it('should expand field iterators before evaluating answer pseudo nodes', async () => {
      // Arrange
      const iteratorRootId = 'compile_ast:2'
      const localAnswerNode = ASTTestFactory.answerLocalPseudoNode('field-1')
      const runtimePlan = createRuntimePlan({
        fieldIteratorRootIds: [iteratorRootId],
      })

      context.nodeRegistry.findByType = jest.fn().mockImplementation((type: string) => {
        if (type === PseudoNodeType.ANSWER_LOCAL) {
          return [localAnswerNode]
        }

        return []
      })

      // Act
      await preparer.prepare(runtimePlan, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenNthCalledWith(1, iteratorRootId, context)
      expect(invoker.invoke).toHaveBeenNthCalledWith(2, localAnswerNode.id, context)
    })

    it('should expand multiple field iterator roots in order before answers', async () => {
      // Arrange
      const firstIteratorRootId = 'compile_ast:3'
      const secondIteratorRootId = 'compile_ast:4'
      const localAnswerNode = ASTTestFactory.answerLocalPseudoNode('field-1')
      const runtimePlan = createRuntimePlan({
        fieldIteratorRootIds: [firstIteratorRootId, secondIteratorRootId],
      })

      context.nodeRegistry.findByType = jest.fn().mockImplementation((type: string) => {
        if (type === PseudoNodeType.ANSWER_LOCAL) {
          return [localAnswerNode]
        }

        return []
      })

      // Act
      await preparer.prepare(runtimePlan, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenNthCalledWith(1, firstIteratorRootId, context)
      expect(invoker.invoke).toHaveBeenNthCalledWith(2, secondIteratorRootId, context)
      expect(invoker.invoke).toHaveBeenNthCalledWith(3, localAnswerNode.id, context)
    })
  })
})
