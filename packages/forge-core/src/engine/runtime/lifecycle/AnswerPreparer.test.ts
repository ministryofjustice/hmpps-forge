import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { PseudoNodeType } from '../../types/pseudoNodes.type'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import AnswerPreparer from './AnswerPreparer'

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
    it('should evaluate local and remote answer pseudo nodes', async () => {
      // Arrange
      const localAnswerNode = ASTTestFactory.answerLocalPseudoNode('field-1')
      const remoteAnswerNode = ASTTestFactory.answerRemotePseudoNode('field-2')

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
      await preparer.prepare(invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
      expect(invoker.invoke).toHaveBeenNthCalledWith(1, localAnswerNode.id, context)
      expect(invoker.invoke).toHaveBeenNthCalledWith(2, remoteAnswerNode.id, context)
    })

    it('should not invoke when no answer pseudo nodes exist', async () => {
      // Act
      await preparer.prepare(invoker, context)

      // Assert
      expect(invoker.invoke).not.toHaveBeenCalled()
    })
  })
})
