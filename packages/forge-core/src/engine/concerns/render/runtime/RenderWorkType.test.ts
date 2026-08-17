import { describe, expect, it, vi } from 'vitest'
import { BlockType, StructureType } from '../../../../authoring/types/enums'
import { buildComponent } from '../../../../components/utils/buildComponent'
import type { BlockDefinition, EvaluatedBlock } from '../../../../components/types/structures.type'
import type { ForgeRenderer, RenderBlock, RenderContext } from '../../../../framework/types/rendering.type'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import { coreComponents } from '../../../../built-ins/components'
import { RENDER_BLOCK_BRAND } from '../contracts/renderBlock.brand'
import WorkContext from '../../../work/WorkContext'
import WorkExecutor from '../../../work/WorkExecutor'
import { createRenderBlocksTask } from './RenderBlocksWorkHandler'
import { createAssemblePageTask } from './RenderAssemblePageWorkHandler'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { createTestRequestState } from '../../../runtime/pipeline/testing-helpers/requestStateTestHelpers'

function createRenderBlock(
  variant: string,
  properties: Record<string, unknown> = {},
  id = `compile_ast:${variant}`,
): RenderBlock {
  return {
    [RENDER_BLOCK_BRAND]: true,
    id,
    variant,
    blockType: BlockType.BASIC,
    properties,
  } as RenderBlock
}

function createComponentRegistry(...variants: string[]): ComponentRegistry {
  const registry = new ComponentRegistry()

  registry.registerMany(variants.map(variant => buildComponent(variant, block => `<${block.variant} />`)))

  return registry
}

function createRenderer(): ForgeRenderer<string> {
  return {
    renderBlock: vi.fn((_entry, block: EvaluatedBlock<BlockDefinition>) => {
      const content = 'content' in block ? block.content : ''

      return `<${block.variant}>${content ?? ''}`
    }),
    wrapNestedBlock: vi.fn((block: BlockDefinition, output: string) => `<wrapped ${block.variant}>${output}</wrapped>`),
    assemblePage: vi.fn((_context, renderedBlocks) => renderedBlocks.join('')),
  }
}

function createRequestContext(traceEnabled = false): RequestState {
  return createTestRequestState(
    {
      request: {
        url: '/step',
        path: '/step',
        method: 'GET',
        location: {
          origin: 'https://example.test',
          href: 'https://example.test/step',
          pathname: '/step',
          basePath: '',
        },
        headers: {},
        cookies: {},
        state: {},
        params: {},
        query: {},
        post: {},
        session: {},
      },
      domain: { data: {}, answers: {} },
      evaluation: {},
    },
    {
      responseBindings: {
        setHeader: vi.fn(),
        setCookie: vi.fn(),
      },
      functionRegistry: { get: vi.fn() } as unknown as FunctionRegistry,
      componentRegistry: new ComponentRegistry(),
      hasRenderer: true,
      traceEnabled,
    },
  )
}

function createMarkingRenderer(): ForgeRenderer<string> {
  return {
    ...createRenderer(),
    markBlock: vi.fn((nodeId: string, output: string) => `<!--forge:${nodeId}-->${output}<!--/forge:${nodeId}-->`),
  }
}

function createRenderContext(blocks: readonly RenderBlock[] = []): RenderContext {
  return {
    routeTree: [],
    step: { path: '/step' },
    ancestors: [],
    blocks: [...blocks],
    showValidationFailures: false,
    fieldValidationErrors: [],
    domainValidationErrors: [],
    answers: {},
    data: {},
  }
}

describe('Render work handlers', () => {
  it('should throw when a top-level block component is not registered', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const componentRegistry = createComponentRegistry('known')
    const task = createRenderBlocksTask([createRenderBlock('missing')], renderer, componentRegistry)

    // Act / Assert
    await expect(executor.execute(task, new WorkContext(createRequestContext()))).rejects.toThrow(
      'Component variant "missing" is not registered',
    )
  })

  it('should throw when a nested block component is not registered', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const componentRegistry = createComponentRegistry('parent')
    const parent = createRenderBlock('parent', {
      content: createRenderBlock('missing', {}, 'compile_ast:nested'),
    })
    const task = createRenderBlocksTask([parent], renderer, componentRegistry)

    // Act / Assert
    await expect(executor.execute(task, new WorkContext(createRequestContext()))).rejects.toThrow(
      'Component variant "missing" is not registered',
    )
  })

  it('should render nested blocks before rendering the parent block', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const componentRegistry = createComponentRegistry('parent', 'child')
    const child = createRenderBlock('child', {}, 'compile_ast:child')
    const parent = createRenderBlock('parent', { content: child }, 'compile_ast:parent')
    const task = createRenderBlocksTask([parent], renderer, componentRegistry)
    const requestContext = createRequestContext()

    // Act
    const result = await executor.execute(task, new WorkContext(requestContext))

    // Assert
    expect(result.output).toEqual(['<parent><wrapped child><child></wrapped>'])
    expect(requestContext.renderedBlocks).toEqual(['<parent><wrapped child><child></wrapped>'])
    expect(renderer.wrapNestedBlock).toHaveBeenCalledWith(
      { type: StructureType.BLOCK, variant: 'child', blockType: BlockType.BASIC },
      '<child>',
    )
  })

  it('should preserve nested block properties when wrapping rendered output', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const componentRegistry = createComponentRegistry('parent', 'child')
    const child = {
      ...createRenderBlock('child', { code: 'goal_title' }, 'compile_ast:child'),
      blockType: BlockType.FIELD,
    }
    const parent = createRenderBlock('parent', { content: child }, 'compile_ast:parent')
    const task = createRenderBlocksTask([parent], renderer, componentRegistry)

    // Act
    await executor.execute(task, new WorkContext(createRequestContext()))

    // Assert
    expect(renderer.wrapNestedBlock).toHaveBeenCalledWith(
      {
        type: StructureType.BLOCK,
        variant: 'child',
        blockType: BlockType.FIELD,
        code: 'goal_title',
      },
      '<child>',
    )
  })

  it('should assemble page output from rendered blocks', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const renderContext = createRenderContext()
    const requestContext = createRequestContext()
    requestContext.recordRenderedBlocks(['<one>', '<two>'])
    const task = createAssemblePageTask(renderContext, renderer)

    // Act
    const result = await executor.execute(task, new WorkContext(requestContext))

    // Assert
    expect(result.output).toBe('<one><two>')
    expect(renderer.assemblePage).toHaveBeenCalledWith(renderContext, ['<one>', '<two>'], {})
  })

  it('should mark the block output with comment markers when the request is traced and the renderer supports it', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createMarkingRenderer()
    const componentRegistry = createComponentRegistry('known')
    const task = createRenderBlocksTask([createRenderBlock('known')], renderer, componentRegistry)

    // Act
    const result = await executor.execute(task, new WorkContext(createRequestContext(true)))

    // Assert
    expect(result.output).toEqual(['<!--forge:compile_ast:known--><known><!--/forge:compile_ast:known-->'])
    expect(renderer.markBlock).toHaveBeenCalledWith('compile_ast:known', '<known>')
  })

  it('should not mark the block output when the request is not traced', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createMarkingRenderer()
    const componentRegistry = createComponentRegistry('known')
    const task = createRenderBlocksTask([createRenderBlock('known')], renderer, componentRegistry)

    // Act
    const result = await executor.execute(task, new WorkContext(createRequestContext(false)))

    // Assert
    expect(result.output).toEqual(['<known>'])
    expect(renderer.markBlock).not.toHaveBeenCalled()
  })

  it('should not mark the block output when the renderer does not implement markBlock', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const componentRegistry = createComponentRegistry('known')
    const task = createRenderBlocksTask([createRenderBlock('known')], renderer, componentRegistry)

    // Act
    const result = await executor.execute(task, new WorkContext(createRequestContext(true)))

    // Assert
    expect(result.output).toEqual(['<known>'])
  })

  it('should render a Fragment as its nested blocks concatenated with no wrapper', async () => {
    // Arrange - a renderer matching the real contract: renderBlock invokes the
    // component's own render, wrapNestedBlock produces a RenderedBlock
    const executor = new WorkExecutor()
    const renderer: ForgeRenderer<string> = {
      renderBlock: (entry, block) => entry.render(block) as string,
      wrapNestedBlock: (block: BlockDefinition, output: string) => ({ block, html: output }),
      assemblePage: (_context, renderedBlocks) => renderedBlocks.join(''),
    }
    const componentRegistry = new ComponentRegistry()
    componentRegistry.registerMany([...coreComponents])
    componentRegistry.registerMany([buildComponent('child', block => `<p>${(block as { text?: string }).text}</p>`)])
    const fragment = createRenderBlock('fragment', {
      blocks: [
        createRenderBlock('child', { text: 'one' }, 'compile_ast:child1'),
        createRenderBlock('child', { text: 'two' }, 'compile_ast:child2'),
      ],
    })
    const task = createRenderBlocksTask([fragment], renderer, componentRegistry)

    // Act
    const result = await executor.execute(task, new WorkContext(createRequestContext()))

    // Assert
    expect(result.output).toEqual(['<p>one</p><p>two</p>'])
  })
})
