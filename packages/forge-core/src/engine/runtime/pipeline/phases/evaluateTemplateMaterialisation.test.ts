import type { BasePhaseContext } from '../../../contracts/compiled/phaseContexts.type'
import type {
  CompiledTemplateMaterialisationRoot,
  MaterialisedTemplateNode,
  TemplateMaterialisationPlan,
} from '../../../contracts/plans/materialisationArtefacts.type'
import type { NodeId, TemplateNodeId } from '../../../contracts/ast/ast.type'
import TraceRecorder from '../trace/TraceRecorder'
import { evaluateTemplateMaterialisation } from './evaluateTemplateMaterialisation'

function createCtx(): BasePhaseContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: { method: 'GET' },
    conditions: { get: vi.fn(() => ({ evaluate: () => undefined })) } as unknown as BasePhaseContext['conditions'],
  } as BasePhaseContext
}

function createNode(overrides: Partial<MaterialisedTemplateNode> = {}): MaterialisedTemplateNode {
  return {
    sourceNodeId: 'template:1' as TemplateNodeId,
    instanceKey: 'test[0]/template:1',
    origin: { iteratorNodeId: 'compile_ast:1' as NodeId, itemIndex: 0 },
    ...overrides,
  }
}

function createRoot(nodeId: string, nodes: MaterialisedTemplateNode[]): CompiledTemplateMaterialisationRoot {
  return {
    nodeId: nodeId as NodeId,
    templateFunctions: new Map(),
    materialise: vi.fn(() => nodes),
  }
}

describe('evaluateTemplateMaterialisation()', () => {
  it('should return empty array for empty plan', async () => {
    // Arrange
    const plan: TemplateMaterialisationPlan = { roots: [] }

    // Act
    const result = await evaluateTemplateMaterialisation(plan, createCtx())

    // Assert
    expect(result).toEqual([])
  })

  it('should return nodes from a single root', async () => {
    // Arrange
    const nodes = [createNode({ origin: { iteratorNodeId: 'compile_ast:1' as NodeId, itemIndex: 0 } })]
    const plan: TemplateMaterialisationPlan = { roots: [createRoot('compile_ast:1', nodes)] }

    // Act
    const result = await evaluateTemplateMaterialisation(plan, createCtx())

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].sourceNodeId).toBe('template:1')
  })

  it('should concatenate nodes from multiple roots in order', async () => {
    // Arrange
    const nodesA = [createNode({ instanceKey: 'a[0]/template:1' })]
    const nodesB = [createNode({ instanceKey: 'b[0]/template:2' })]
    const plan: TemplateMaterialisationPlan = {
      roots: [createRoot('compile_ast:1', nodesA), createRoot('compile_ast:2', nodesB)],
    }

    // Act
    const result = await evaluateTemplateMaterialisation(plan, createCtx())

    // Assert
    expect(result).toHaveLength(2)
    expect(result[0].instanceKey).toBe('a[0]/template:1')
    expect(result[1].instanceKey).toBe('b[0]/template:2')
  })

  it('should pass context and templateFunctions to materialiser functions', async () => {
    // Arrange
    const ctx = createCtx()
    const root = createRoot('compile_ast:1', [])
    const plan: TemplateMaterialisationPlan = { roots: [root] }

    // Act
    await evaluateTemplateMaterialisation(plan, ctx)

    // Assert
    expect(root.materialise).toHaveBeenCalledWith(ctx, root.templateFunctions)
  })

  it('should record trace units per root when trace is provided', async () => {
    // Arrange
    const nodes = [
      createNode({ origin: { iteratorNodeId: 'compile_ast:1' as NodeId, itemIndex: 0 } }),
      createNode({ origin: { iteratorNodeId: 'compile_ast:1' as NodeId, itemIndex: 1 } }),
    ]
    const plan: TemplateMaterialisationPlan = { roots: [createRoot('compile_ast:1', nodes)] }
    const trace = new TraceRecorder()

    trace.beginPhase('template-materialisation')

    // Act
    await evaluateTemplateMaterialisation(plan, createCtx(), trace)

    trace.endPhase('continue')
    const requestTrace = trace.finish('render')

    // Assert
    const phase = requestTrace.phases.find(p => p.phase === 'template-materialisation')

    expect(phase).toBeDefined()
    expect(phase!.units).toHaveLength(1)
    expect(phase!.units[0]).toMatchObject({
      kind: 'template-materialisation',
      nodeId: 'compile_ast:1',
      nodeCount: 2,
      itemCount: 2,
    })
  })

  it('should handle async materialiser functions', async () => {
    // Arrange
    const nodes = [createNode()]
    const asyncRoot: CompiledTemplateMaterialisationRoot = {
      nodeId: 'compile_ast:1' as NodeId,
      templateFunctions: new Map(),
      materialise: vi.fn(async () => nodes),
    }
    const plan: TemplateMaterialisationPlan = { roots: [asyncRoot] }

    // Act
    const result = await evaluateTemplateMaterialisation(plan, createCtx())

    // Assert
    expect(result).toHaveLength(1)
  })
})
