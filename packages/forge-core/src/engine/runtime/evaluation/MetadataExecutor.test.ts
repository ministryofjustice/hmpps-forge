import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { AstNodeId, NodeId } from '../../types/engine.type'
import { ASTNodeType } from '../../types/enums'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { BlockType } from '../../../authoring/types/enums'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import MetadataExecutor from './MetadataExecutor'

function createRuntimePlan(options: Partial<StepRuntimePlan> = {}): StepRuntimePlan {
  return {
    stepId: 'compile_ast:1',
    path: '/step',
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

describe('MetadataExecutor', () => {
  let executor: MetadataExecutor
  let context: Mocked<ThunkEvaluationContext>
  let invoker: Mocked<ThunkInvocationAdapter>
  let nodes: Map<NodeId, JourneyASTNode | StepASTNode | object>

  beforeEach(() => {
    ASTTestFactory.resetIds()
    executor = new MetadataExecutor()
    nodes = new Map()
    context = {
      nodeRegistry: {
        get: vi.fn((nodeId: NodeId) => nodes.get(nodeId)),
        has: vi.fn((nodeId: NodeId) => nodes.has(nodeId)),
      },
    } as unknown as Mocked<ThunkEvaluationContext>
    invoker = {
      invoke: vi.fn(),
      invokeSync: vi.fn(),
    } as unknown as Mocked<ThunkInvocationAdapter>
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
    })

    it('should compose ancestor paths through the hierarchy', async () => {
      // Arrange
      const rootJourney = ASTTestFactory.journey()
        .withId('compile_ast:root')
        .withCode('root')
        .withTitle('Root')
        .withProperty('path', '/root')
        .build()
      const childJourney = ASTTestFactory.journey()
        .withId('compile_ast:child')
        .withCode('child')
        .withTitle('Child')
        .withProperty('path', '/child')
        .build()
      const step = ASTTestFactory.step()
        .withId('compile_ast:step')
        .withPath('/step')
        .withTitle('Step')
        .build()
      const runtimePlan = createRuntimePlan({
        renderAncestorIds: [rootJourney.id, childJourney.id],
        renderStepId: step.id,
      })

      nodes.set(rootJourney.id, rootJourney)
      nodes.set(childJourney.id, childJourney)
      nodes.set(step.id, step)

      // Act
      const result = await executor.execute(runtimePlan, invoker, context)

      // Assert
      expect(result.ancestors).toEqual([
        { code: 'root', path: '/root', title: 'Root' },
        { code: 'child', path: '/root/child', title: 'Child' },
      ])
    })
  })
})
