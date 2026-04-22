import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { NodeId } from '../../types/engine.type'
import ASTNodeTree from '../../compilation/node-tree/ASTNodeTree'
import StepFieldInventoryAnalyzer from './StepFieldInventoryAnalyzer'

function createEntry(options: {
  stepId: NodeId
  path: string
  isEntryPoint?: boolean
  cleardownFieldCodes?: string[]
  iterateNodeIds?: NodeId[]
}): ReachabilityStepEntry {
  return {
    stepId: options.stepId,
    path: options.path,
    isEntryPoint: options.isEntryPoint ?? false,
    entryWhenNodeId: undefined,
    forwardOutcomeIds: [],
    hasValidation: false,
    cleardownFieldCodes: options.cleardownFieldCodes ?? [],
    iterateNodeIds: options.iterateNodeIds ?? [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    reachabilityTieBreakers: [],
  }
}

describe('StepFieldInventoryAnalyzer', () => {
  let analyzer: StepFieldInventoryAnalyzer
  let context: Mocked<ThunkEvaluationContext>

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
      astNodeTree: new ASTNodeTree(),
    } as unknown as Mocked<ThunkEvaluationContext>
  })

  it('should collect cleardown field codes from plan entries', () => {
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
    const result = analyzer.analyze(plan, context)

    // Assert
    expect(result[0].cleardownFieldCodes).toEqual(['fieldA', '^task_\\d+$'])
  })

  it('should collect field codes by matching field blocks to steps via ancestor chain', () => {
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

    const tree = new ASTNodeTree()

    tree.addNode('compile_ast:1' as NodeId)
    tree.addNode('compile_ast:2' as NodeId)
    tree.addNode('compile_ast:10' as NodeId, 'compile_ast:1' as NodeId)
    tree.addNode('compile_ast:11' as NodeId, 'compile_ast:1' as NodeId)
    tree.addNode('compile_ast:12' as NodeId, 'compile_ast:2' as NodeId)
    ;(context as { astNodeTree: unknown }).astNodeTree = tree

    // Act
    const result = analyzer.analyze(plan, context)

    // Assert
    expect(result[0].fieldCodes).toEqual(['firstName', 'lastName'])
    expect(result[1].fieldCodes).toEqual(['email'])
  })

  it('should deduplicate field codes per step', () => {
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

    const tree = new ASTNodeTree()

    tree.addNode('compile_ast:1' as NodeId)
    tree.addNode('compile_ast:10' as NodeId, 'compile_ast:1' as NodeId)
    tree.addNode('compile_ast:11' as NodeId, 'compile_ast:1' as NodeId)
    ;(context as { astNodeTree: unknown }).astNodeTree = tree

    // Act
    const result = analyzer.analyze(plan, context)

    // Assert
    expect(result[0].fieldCodes).toEqual(['name'])
  })
})
