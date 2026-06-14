import { evaluateRender } from './evaluateRender'
import TraceRecorder from '../trace/TraceRecorder'
import { BlockType } from '../../../../authoring/types/enums'
import type { RenderCompilationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { RenderPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { RenderBlock } from '../../../../framework/rendering/types'

const mockCtx = {} as RenderCompilationContext

function createBlock(id: string): RenderBlock {
  return { id: id as RenderBlock['id'], variant: 'content', blockType: BlockType.BASIC, properties: {} }
}

const runTraced = async (plan: RenderPlan) => {
  const recorder = new TraceRecorder()

  recorder.beginPhase('render-evaluation')

  const result = await evaluateRender(plan, mockCtx, recorder)

  recorder.endPhase('continue')

  return { result, units: recorder.finish('render').phases[0].units }
}

describe('evaluateRender', () => {
  describe('block tracing', () => {
    it('should record one evaluation per static block when tracing', async () => {
      // Arrange
      const plan: RenderPlan = {
        renderBlocks: [
          {
            nodeId: 'compile_ast:2' as const,
            variant: 'text-input',
            render: vi.fn().mockResolvedValue(createBlock('compile_ast:2')),
          },
          {
            nodeId: 'compile_ast:3' as const,
            variant: 'radios',
            render: vi.fn().mockResolvedValue(createBlock('compile_ast:3')),
          },
        ],
        iteratorRenderBlockGroups: [],
      }

      // Act
      const { result, units } = await runTraced(plan)

      // Assert
      expect(result.blocks).toHaveLength(2)
      expect(units).toEqual([
        expect.objectContaining({ kind: 'block-evaluation', nodeId: 'compile_ast:2', variant: 'text-input' }),
        expect.objectContaining({ kind: 'block-evaluation', nodeId: 'compile_ast:3', variant: 'radios' }),
      ])
    })

    it('should record nothing and still render when no recorder is supplied', async () => {
      // Arrange
      const plan: RenderPlan = {
        renderBlocks: [
          {
            nodeId: 'compile_ast:2' as const,
            variant: 'text-input',
            render: vi.fn().mockResolvedValue(createBlock('compile_ast:2')),
          },
        ],
        iteratorRenderBlockGroups: [],
      }

      // Act
      const result = await evaluateRender(plan, mockCtx)

      // Assert
      expect(result.blocks).toHaveLength(1)
    })
  })

  describe('iterator tracing', () => {
    it('should record the iterator expansion and one evaluation per block per item when tracing', async () => {
      // Arrange
      const itemScopes = [
        { item: { value: 'a' }, index: 0, rawItem: 'a', inputLength: 2 },
        { item: { value: 'b' }, index: 1, rawItem: 'b', inputLength: 2 },
      ]
      const plan: RenderPlan = {
        renderBlocks: [],
        iteratorRenderBlockGroups: [
          {
            nodeId: 'compile_ast:5' as const,
            evaluateInput: vi.fn().mockResolvedValue(itemScopes),
            blocks: [
              {
                nodeId: 'template:1' as const,
                variant: 'text-input',
                render: vi.fn().mockResolvedValue(createBlock('template:1')),
              },
            ],
          },
        ],
      }

      // Act
      const { result, units } = await runTraced(plan)

      // Assert
      expect(result.blocks).toHaveLength(2)
      expect(units).toEqual([
        expect.objectContaining({ kind: 'iterator-input', nodeId: 'compile_ast:5', itemCount: 2 }),
        expect.objectContaining({ kind: 'block-evaluation', nodeId: 'template:1', itemIndex: 0 }),
        expect.objectContaining({ kind: 'block-evaluation', nodeId: 'template:1', itemIndex: 1 }),
      ])
    })
  })
})
