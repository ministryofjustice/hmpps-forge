import { BlockType } from '../../../../authoring/types/enums'
import type { CompiledResolveContext } from '../../../contracts/compiled/compiledContexts.type'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import WorkContext from '../../../work/WorkContext'
import WorkExecutor from '../../../work/WorkExecutor'
import { createWorkTask } from '../../../work/workTask'
import { RESOLVE_BLOCK_WORK_HANDLER } from './ResolveBlockWorkHandler'
import { RESOLVE_BLOCKS_WORK_HANDLER, RESOLVE_BLOCKS_WORK_INSTRUMENTATION } from './ResolveBlocksWorkHandler'

function createContext(): WorkContext<CompiledResolveContext> {
  return new WorkContext({
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    post: {},
    fieldFailures: {},
    fieldFailureAnchors: {},
    components: new ComponentRegistry(),
    request: {},
    workTasks: {},
    conditions: {
      get: vi.fn(),
    } as unknown as CompiledResolveContext['conditions'],
  })
}

describe('ResolveBlocksWorkHandler', () => {
  describe('execute()', () => {
    it('should execute top-level resolve blocks concurrently and return their outputs in order', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const first = createWorkTask('first', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:1',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<p>First</p>' },
      })
      const second = createWorkTask('second', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:2',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<p>Second</p>' },
      })
      const element = createWorkTask('resolve-blocks', RESOLVE_BLOCKS_WORK_HANDLER, {
        blocks: [first, second],
        step: {},
        ancestors: [],
      })

      // Act
      const result = await executor.execute(element, createContext())

      // Assert
      expect(result.children.map(child => child.key)).toEqual(['first', 'second'])
      expect(result.output.blocks.map(block => block.id)).toEqual(['compile_ast:1', 'compile_ast:2'])
    })

    it('should declare resolve root trace fields attached by the executor', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const visible = createWorkTask('visible', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:1',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<p>Visible</p>' },
      })
      const hidden = createWorkTask('hidden', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:2',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { visibleWhen: false },
      })
      const element = createWorkTask(
        'resolve-blocks',
        RESOLVE_BLOCKS_WORK_HANDLER,
        {
          blocks: [visible, hidden],
          step: {},
          ancestors: [],
        },
        RESOLVE_BLOCKS_WORK_INSTRUMENTATION,
      )

      // Act
      const result = await executor.executeWithUnit(element, createContext())

      // Assert
      expect(result.traceSpan.beginFields).toEqual({ blocks: 2 })
      expect(result.traceSpan.completeFields).toEqual({ visibleBlocks: 1 })
    })
  })
})
