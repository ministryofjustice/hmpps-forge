import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import { AstNodeId, NodeId } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import RenderExecutor from './RenderExecutor'

function createRuntimePlan(options: Partial<StepRuntimePlan> = {}): StepRuntimePlan {
  return {
    stepId: 'compile_ast:1',
    accessAncestorIds: ['compile_ast:1'],
    actionTransitionIds: [],
    submitTransitionIds: [],
    fieldIteratorRootIds: [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    renderAncestorIds: [],
    renderStepId: 'compile_ast:1',
    isRenderSync: false,
    isAnswerPrepareSync: false,
    isValidationSync: false,
    hasValidatingSubmitTransition: false,
    hasDomainValidation: false,
    ...options,
  }
}

describe('RenderExecutor', () => {
  let executor: RenderExecutor
  let context: jest.Mocked<ThunkEvaluationContext>
  let invoker: jest.Mocked<ThunkInvocationAdapter>
  let nodes: Map<NodeId, object>

  beforeEach(() => {
    ASTTestFactory.resetIds()
    executor = new RenderExecutor()
    nodes = new Map()
    context = {
      nodeRegistry: {
        get: jest.fn((nodeId: NodeId) => nodes.get(nodeId)),
        has: jest.fn((nodeId: NodeId) => nodes.has(nodeId)),
      },
    } as unknown as jest.Mocked<ThunkEvaluationContext>
    invoker = {
      invoke: jest.fn(),
      invokeSync: jest.fn(),
    } as unknown as jest.Mocked<ThunkInvocationAdapter>
  })

  describe('execute()', () => {
    it('should evaluate only the current step blocks', async () => {
      // Arrange
      const dynamicTitleId = 'compile_ast:10' as AstNodeId
      const dynamicTitle = { id: dynamicTitleId, type: ASTNodeType.EXPRESSION }
      const firstBlock = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withId('compile_ast:block-1')
        .build()
      const secondBlock = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withId('compile_ast:block-2')
        .build()
      const evaluatedFirstBlock = {
        id: firstBlock.id,
        type: ASTNodeType.BLOCK,
        blockType: BlockType.FIELD,
        variant: firstBlock.variant,
        properties: { label: 'First' },
      }
      const evaluatedSecondBlock = {
        id: secondBlock.id,
        type: ASTNodeType.BLOCK,
        blockType: BlockType.FIELD,
        variant: secondBlock.variant,
        properties: { label: 'Second' },
      }
      const step = ASTTestFactory.step()
        .withId('compile_ast:step')
        .withPath('/step')
        .withTitle('Step')
        .withProperty('title', dynamicTitle)
        .withProperty('blocks', [firstBlock, secondBlock])
        .build()
      const runtimePlan = createRuntimePlan({ renderStepId: step.id })

      nodes.set(step.id, step)
      nodes.set(dynamicTitleId, dynamicTitle)
      nodes.set(firstBlock.id, firstBlock)
      nodes.set(secondBlock.id, secondBlock)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === firstBlock.id) {
          return { value: evaluatedFirstBlock, metadata: { source: 'test', timestamp: Date.now() } }
        }

        if (nodeId === secondBlock.id) {
          return { value: evaluatedSecondBlock, metadata: { source: 'test', timestamp: Date.now() } }
        }

        if (nodeId === dynamicTitle.id) {
          return { value: 'Ignored title', metadata: { source: 'test', timestamp: Date.now() } }
        }

        return { value: undefined, metadata: { source: 'test', timestamp: Date.now() } }
      })

      // Act
      const result = await executor.execute(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual([evaluatedFirstBlock, evaluatedSecondBlock])
      expect(invoker.invoke).toHaveBeenCalledWith(firstBlock.id, context)
      expect(invoker.invoke).toHaveBeenCalledWith(secondBlock.id, context)
      expect(invoker.invoke).not.toHaveBeenCalledWith(dynamicTitle.id, context)
    })
  })
})
