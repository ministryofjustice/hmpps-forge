import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter, ThunkResult } from '../../compilation/thunks/types'
import { NodeId } from '../../types/engine.type'
import MetadataRegistry from '../../compilation/registries/MetadataRegistry'
import StepFieldInventoryAnalyzer from './StepFieldInventoryAnalyzer'

function createEntry(options: {
  stepId: NodeId
  path: string
  isEntryPoint?: boolean
  cleardownFieldCodes?: string[]
  fieldIteratorRootIds?: NodeId[]
}): ReachabilityStepEntry {
  return {
    stepId: options.stepId,
    path: options.path,
    isEntryPoint: options.isEntryPoint ?? false,
    entryWhenNodeId: undefined,
    forwardOutcomeIds: [],
    hasValidation: false,
    cleardownFieldCodes: options.cleardownFieldCodes ?? [],
    fieldIteratorRootIds: options.fieldIteratorRootIds ?? [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    reachabilityTieBreakers: [],
  }
}

function successResult<T>(value: T): ThunkResult<T> {
  return { value, metadata: { source: 'test', timestamp: Date.now() } }
}

describe('StepFieldInventoryAnalyzer', () => {
  let analyzer: StepFieldInventoryAnalyzer
  let context: Mocked<ThunkEvaluationContext>
  let invoker: Mocked<ThunkInvocationAdapter>

  beforeEach(() => {
    analyzer = new StepFieldInventoryAnalyzer()

    context = {
      global: {
        answers: {},
        data: {},
      },
      nodeRegistry: {
        findByType: vi.fn().mockReturnValue([]),
      },
      metadataRegistry: {},
    } as unknown as Mocked<ThunkEvaluationContext>

    invoker = {
      invoke: vi.fn().mockResolvedValue(successResult(undefined)),
      invokeSync: vi.fn(),
    } as unknown as Mocked<ThunkInvocationAdapter>
  })

  it('should collect cleardown field codes from plan entries', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:42',
          path: 'step-a',
          isEntryPoint: true,
          cleardownFieldCodes: ['fieldA', '^task_\\d+$'],
        }),
      ],
      resumeAlways: false,
      reachabilityDisabled: false,
    }

    // Act
    const result = await analyzer.analyze(plan, invoker, context)

    // Assert
    expect(result[0].cleardownFieldCodes).toEqual(['fieldA', '^task_\\d+$'])
  })

  it('should collect field codes by matching field blocks to steps via ancestor chain', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:1', path: 'step-a', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:2', path: 'step-b' }),
      ],
      resumeAlways: false,
      reachabilityDisabled: false,
    }

    vi.mocked(context.nodeRegistry.findByType).mockReturnValue([
      { id: 'compile_ast:10', properties: { code: 'firstName' } },
      { id: 'compile_ast:11', properties: { code: 'lastName' } },
      { id: 'compile_ast:12', properties: { code: 'email' } },
    ] as never)

    const registry = new MetadataRegistry()

    registry.set('compile_ast:10', 'attachedToParentNode', 'compile_ast:1')
    registry.set('compile_ast:11', 'attachedToParentNode', 'compile_ast:1')
    registry.set('compile_ast:12', 'attachedToParentNode', 'compile_ast:2')
    ;(context as { metadataRegistry: unknown }).metadataRegistry = registry

    // Act
    const result = await analyzer.analyze(plan, invoker, context)

    // Assert
    expect(result[0].fieldCodes).toEqual(['firstName', 'lastName'])
    expect(result[1].fieldCodes).toEqual(['email'])
  })

  it('should expand field iterators before collecting codes', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:1',
          path: 'step-a',
          isEntryPoint: true,
          fieldIteratorRootIds: ['compile_ast:100'],
        }),
      ],
      resumeAlways: false,
      reachabilityDisabled: false,
    }

    // Act
    await analyzer.analyze(plan, invoker, context)

    // Assert
    expect(invoker.invoke).toHaveBeenCalledWith('compile_ast:100', context)
  })

  it('should deduplicate field codes per step', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [createEntry({ stepId: 'compile_ast:1', path: 'step-a', isEntryPoint: true })],
      resumeAlways: false,
      reachabilityDisabled: false,
    }

    vi.mocked(context.nodeRegistry.findByType).mockReturnValue([
      { id: 'compile_ast:10', properties: { code: 'name' } },
      { id: 'compile_ast:11', properties: { code: 'name' } },
    ] as never)

    const registry = new MetadataRegistry()

    registry.set('compile_ast:10', 'attachedToParentNode', 'compile_ast:1')
    registry.set('compile_ast:11', 'attachedToParentNode', 'compile_ast:1')
    ;(context as { metadataRegistry: unknown }).metadataRegistry = registry

    // Act
    const result = await analyzer.analyze(plan, invoker, context)

    // Assert
    expect(result[0].fieldCodes).toEqual(['name'])
  })
})
