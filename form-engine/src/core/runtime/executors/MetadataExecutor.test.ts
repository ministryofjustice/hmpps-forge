import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import { AstNodeId, NodeId } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { BlockType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import MetadataExecutor from './MetadataExecutor'

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

describe('MetadataExecutor', () => {
  let executor: MetadataExecutor
  let context: jest.Mocked<ThunkEvaluationContext>
  let invoker: jest.Mocked<ThunkInvocationAdapter>
  let nodes: Map<NodeId, JourneyASTNode | StepASTNode | object>

  beforeEach(() => {
    ASTTestFactory.resetIds()
    executor = new MetadataExecutor()
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
    it('should evaluate ancestor and step metadata without evaluating blocks', async () => {
      // Arrange
      const dynamicTitleId = 'compile_ast:10' as AstNodeId
      const dynamicJourneyTitleId = 'compile_ast:11' as AstNodeId
      const dynamicTitle = { id: dynamicTitleId, type: ASTNodeType.EXPRESSION }
      const dynamicJourneyTitle = { id: dynamicJourneyTitleId, type: ASTNodeType.EXPRESSION }
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withId('compile_ast:block')
        .build()
      const step = ASTTestFactory.step()
        .withId('compile_ast:step')
        .withPath('/step')
        .withTitle('Static title')
        .withProperty('title', dynamicTitle)
        .withProperty('blocks', [block])
        .withProperty('backlink', '/previous')
        .build()
      const journey = ASTTestFactory.journey()
        .withId('compile_ast:journey')
        .withCode('journey')
        .withTitle('Journey')
        .withProperty('path', '/journey')
        .withProperty('title', dynamicJourneyTitle)
        .withProperty('steps', [step])
        .build()
      const runtimePlan = createRuntimePlan({
        renderAncestorIds: [journey.id],
        renderStepId: step.id,
      })

      nodes.set(step.id, step)
      nodes.set(journey.id, journey)
      nodes.set(dynamicTitleId, dynamicTitle)
      nodes.set(dynamicJourneyTitleId, dynamicJourneyTitle)
      nodes.set(block.id, block)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === dynamicTitle.id) {
          return { value: 'Evaluated step title', metadata: { source: 'test', timestamp: Date.now() } }
        }

        if (nodeId === dynamicJourneyTitle.id) {
          return { value: 'Evaluated journey title', metadata: { source: 'test', timestamp: Date.now() } }
        }

        return { value: undefined, metadata: { source: 'test', timestamp: Date.now() } }
      })

      // Act
      const result = await executor.execute(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({
        step: {
          path: '/step',
          title: 'Evaluated step title',
          backlink: '/previous',
        },
        ancestors: [
          {
            code: 'journey',
            path: '/journey',
            title: 'Evaluated journey title',
          },
        ],
      })
      expect(invoker.invoke).toHaveBeenCalledWith(dynamicTitle.id, context)
      expect(invoker.invoke).toHaveBeenCalledWith(dynamicJourneyTitle.id, context)
      expect(invoker.invoke).not.toHaveBeenCalledWith(block.id, context)
    })
  })
})
