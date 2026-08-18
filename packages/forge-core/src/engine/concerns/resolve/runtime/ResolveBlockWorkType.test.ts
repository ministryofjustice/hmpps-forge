import { BlockType } from '../../../../authoring/types/enums'
import type { CompiledResolveContext } from '../../../chassis/contracts/compiled/compiledContexts.type'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import WorkContext from '../../../chassis/work/WorkContext'
import TraceSpan from '../../../chassis/tracing/TraceSpan'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import { createWorkTask } from '../../../chassis/work/workTask'
import { isRenderBlock } from './typeguards'
import { RESOLVE_BLOCK_WORK_HANDLER, RESOLVE_BLOCK_WORK_INSTRUMENTATION } from './ResolveBlockWorkHandler'

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

describe('ResolveBlockWorkHandler', () => {
  describe('execute()', () => {
    it('should complete to a branded render block when it has no child tasks', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const element = createWorkTask('content', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:1',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<p>Hello</p>' },
      })

      // Act
      const result = await executor.execute(element, createContext())

      // Assert
      expect(isRenderBlock(result.output)).toBe(true)
      expect(result.output).toMatchObject({
        id: 'compile_ast:1',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<p>Hello</p>' },
      })
      expect(result.children).toEqual([])
    })

    it('should replace nested render tasks with completed resolve blocks', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const child = createWorkTask('child', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:2',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<span>Child</span>' },
      })
      const parent = createWorkTask('parent', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:3',
        variant: 'templateWrapper',
        blockType: BlockType.BASIC,
        properties: {
          content: child,
        },
      })

      // Act
      const result = await executor.execute(parent, createContext())

      // Assert
      expect(result.children.map(childResult => childResult.key)).toEqual(['child'])
      expect(result.output.properties.content).toMatchObject({
        id: 'compile_ast:2',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<span>Child</span>' },
      })
      expect(isRenderBlock(result.output.properties.content)).toBe(true)
    })

    it('should replace multiple sibling nested tasks in their own slots', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const header = createWorkTask('header', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:4',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<h1>Header</h1>' },
      })
      const footer = createWorkTask('footer', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:5',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<footer>Footer</footer>' },
      })
      const parent = createWorkTask('parent', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:6',
        variant: 'templateWrapper',
        blockType: BlockType.BASIC,
        properties: { header, footer },
      })

      // Act
      const result = await executor.execute(parent, createContext())

      // Assert
      expect(result.children.map(child => child.key)).toEqual(['header', 'footer'])
      expect(result.output.properties.header).toMatchObject({ properties: { html: '<h1>Header</h1>' } })
      expect(result.output.properties.footer).toMatchObject({ properties: { html: '<footer>Footer</footer>' } })
    })

    it('should keep sibling outputs in their own slots when tasks share a key and kind', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const left = createWorkTask('compile_ast:7', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:7',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<p>Left</p>' },
      })
      const right = createWorkTask('compile_ast:7', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:7',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { html: '<p>Right</p>' },
      })
      const parent = createWorkTask('parent', RESOLVE_BLOCK_WORK_HANDLER, {
        id: 'compile_ast:8',
        variant: 'templateWrapper',
        blockType: BlockType.BASIC,
        properties: { left, right },
      })

      // Act
      const result = await executor.execute(parent, createContext())

      // Assert — identical key+kind siblings are distinguished only by traversal position
      expect(result.children.map(child => child.key)).toEqual(['compile_ast:7', 'compile_ast:7'])
      expect(result.output.properties.left).toMatchObject({ properties: { html: '<p>Left</p>' } })
      expect(result.output.properties.right).toMatchObject({ properties: { html: '<p>Right</p>' } })
    })

    it('should declare render trace fields attached by the executor', async () => {
      // Arrange
      const root = new TraceSpan('root', 'render.root')
      const executor = new WorkExecutor()
      const element = createWorkTask(
        'content',
        RESOLVE_BLOCK_WORK_HANDLER,
        {
          id: 'compile_ast:1',
          variant: 'html',
          blockType: BlockType.BASIC,
          properties: { visibleWhen: false },
        },
        RESOLVE_BLOCK_WORK_INSTRUMENTATION,
      )

      // Act
      await executor.execute(element, createContext().withWork(root, {}))

      // Assert
      expect(root.children[0].beginFields).toEqual({
        id: 'compile_ast:1',
        variant: 'html',
        blockType: BlockType.BASIC,
      })
      expect(root.children[0].completeFields).toEqual({ visible: false, properties: { visibleWhen: false } })
    })
  })
})
