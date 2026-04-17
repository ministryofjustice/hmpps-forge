import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { PseudoNodeType } from '../../types/pseudoNodes.type'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import AnswerPreparer from './AnswerPreparer'

function createRuntimePlan(options: Partial<StepRuntimePlan> = {}): StepRuntimePlan {
  return {
    stepId: 'compile_ast:1',
    accessAncestorIds: ['compile_ast:1'],
    actionHookIds: [],
    submitHookIds: [],
    fieldIteratorRootIds: [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    renderAncestorIds: [],
    renderStepId: 'compile_ast:1',
    hasValidatingSubmitHook: false,
    hasDomainValidation: false,
    ...options,
  }
}

describe('AnswerPreparer', () => {
  let preparer: AnswerPreparer
  let context: Mocked<ThunkEvaluationContext>
  let invoker: Mocked<ThunkInvocationAdapter>

  beforeEach(() => {
    ASTTestFactory.resetIds()
    preparer = new AnswerPreparer()
    context = {
      nodeRegistry: {
        findByType: vi.fn().mockReturnValue([]),
      },
    } as unknown as Mocked<ThunkEvaluationContext>
    invoker = {
      invoke: vi.fn().mockResolvedValue({ value: undefined, metadata: { source: 'test', timestamp: Date.now() } }),
      invokeSync: vi.fn(),
    } as unknown as Mocked<ThunkInvocationAdapter>
  })

  describe('prepare()', () => {
    it('should evaluate answer pseudo nodes when there are no field iterators', async () => {
      // Arrange
      const localAnswerNode = ASTTestFactory.answerLocalPseudoNode('field-1')
      const remoteAnswerNode = ASTTestFactory.answerRemotePseudoNode('field-2')
      const runtimePlan = createRuntimePlan()

      context.nodeRegistry.findByType = vi.fn().mockImplementation((type: string) => {
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

      context.nodeRegistry.findByType = vi.fn().mockImplementation((type: string) => {
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

      context.nodeRegistry.findByType = vi.fn().mockImplementation((type: string) => {
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
