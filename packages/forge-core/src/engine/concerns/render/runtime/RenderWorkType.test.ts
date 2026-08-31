import { describe, expect, it, vi } from 'vitest'
import { ComponentCallType, FunctionEntryType } from '../../../../shared/taxonomy'
import { component } from '../../../../components/presentation'
import type { BlockDefinition } from '../../../../components/types/structures.type'
import type { ForgeRenderer, RenderBlock, RenderContext } from '../../../../framework/types/rendering.type'
import { builtInComponents } from '../../../../built-ins/components'
import { RENDER_BLOCK_BRAND } from '../contracts/renderBlock.brand'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import { createRenderBlocksTask } from './RenderBlocksWorkHandler'
import { createAssemblePageTask } from './RenderAssemblePageWorkHandler'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import type { FunctionEntry } from '../../../../authoring/types/functions.type'
import type { ComponentFunctionInput } from '../../../../components/types/renderFunctions.type'
import { createTestRequestState } from '../../../chassis/runtime/pipeline/testing-helpers/requestStateTestHelpers'

function createRenderBlock(
  variant: string,
  properties: Record<string, unknown> = {},
  id = `compile_ast:${variant}`,
): RenderBlock {
  return {
    [RENDER_BLOCK_BRAND]: true,
    id,
    variant,
    blockType: ComponentCallType.BASIC,
    properties,
  } as RenderBlock
}

function createRenderFunctionRegistry(...variants: string[]): FunctionRegistry {
  const registry = new FunctionRegistry()

  registry.register(
    Object.fromEntries(
      variants.map(name => [
        name,
        {
          name,
          _forge: FunctionEntryType.COMPONENT,
          evaluate: ({ props }: ComponentFunctionInput<Record<string, unknown>>) => `<${name}>${props.content ?? ''}`,
        },
      ]),
    ),
  )

  return registry
}

function createRenderer(): ForgeRenderer<string> {
  return {
    wrapNestedBlock: vi.fn((block: BlockDefinition, output: string) => `<wrapped ${block.variant}>${output}</wrapped>`),
    assemblePage: vi.fn((_context, renderedBlocks) => renderedBlocks.join('')),
  }
}

function createRequestContext(traceEnabled = false, functionRegistry = new FunctionRegistry()): RequestState {
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
      functionRegistry,
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
    const functionRegistry = createRenderFunctionRegistry('known')
    const task = createRenderBlocksTask([createRenderBlock('missing')], renderer)

    // Act / Assert
    await expect(
      executor.execute(task, new WorkContext(createRequestContext(false, functionRegistry))),
    ).rejects.toThrow('Component variant "missing" is not registered')
  })

  it('should throw when a nested block component is not registered', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const functionRegistry = createRenderFunctionRegistry('parent')
    const parent = createRenderBlock('parent', {
      content: createRenderBlock('missing', {}, 'compile_ast:nested'),
    })
    const task = createRenderBlocksTask([parent], renderer)

    // Act / Assert
    await expect(
      executor.execute(task, new WorkContext(createRequestContext(false, functionRegistry))),
    ).rejects.toThrow('Component variant "missing" is not registered')
  })

  it('should render nested blocks before rendering the parent block', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const functionRegistry = createRenderFunctionRegistry('parent', 'child')
    const child = createRenderBlock('child', {}, 'compile_ast:child')
    const parent = createRenderBlock('parent', { content: child }, 'compile_ast:parent')
    const task = createRenderBlocksTask([parent], renderer)
    const requestContext = createRequestContext(false, functionRegistry)

    // Act
    const result = await executor.execute(task, new WorkContext(requestContext))

    // Assert
    expect(result.output).toEqual(['<parent><wrapped child><child></wrapped>'])
    expect(requestContext.renderedBlocks).toEqual(['<parent><wrapped child><child></wrapped>'])
    expect(renderer.wrapNestedBlock).toHaveBeenCalledWith(
      { _forge: ComponentCallType.BASIC, variant: 'child' },
      '<child>',
    )
    expect(renderer.wrapNestedBlock).toHaveBeenCalledTimes(1)
  })

  it('should render structured block leaves concurrently and reconstruct their shape', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const pendingResolvers: Array<() => void> = []
    const functionRegistry = new FunctionRegistry()

    functionRegistry.register({
      first: {
        name: 'first',
        _forge: FunctionEntryType.COMPONENT,
        evaluate: () =>
          new Promise<string>(resolve => {
            pendingResolvers.push(() => resolve('<first>'))
          }),
      },
      second: {
        name: 'second',
        _forge: FunctionEntryType.COMPONENT,
        evaluate: () =>
          new Promise<string>(resolve => {
            pendingResolvers.push(() => resolve('<second>'))
          }),
      },
    })

    const renderer: ForgeRenderer<string> = {
      wrapNestedBlock: (block, html) => ({ block, html }),
      assemblePage: (_context, renderedBlocks) => renderedBlocks.join(''),
    }
    const first = createRenderBlock('first', {}, 'compile_ast:first')
    const second = createRenderBlock('second', {}, 'compile_ast:second')
    const task = createRenderBlocksTask({ header: first, rows: [[second]] }, renderer, true)
    const requestContext = createRequestContext(false, functionRegistry)

    // Act
    const execution = executor.execute(task, new WorkContext(requestContext))
    await vi.waitFor(() => expect(pendingResolvers).toHaveLength(2))
    pendingResolvers.reverse().forEach(resolve => resolve())
    const result = await execution

    // Assert
    expect(result.output).toEqual(['<first>', '<second>'])
    expect(requestContext.renderedBlocks).toEqual(['<first>', '<second>'])
    expect(requestContext.renderedBlockShape).toEqual({
      header: {
        block: { _forge: ComponentCallType.BASIC, variant: 'first' },
        html: '<first>',
      },
      rows: [
        [
          {
            block: { _forge: ComponentCallType.BASIC, variant: 'second' },
            html: '<second>',
          },
        ],
      ],
    })
  })

  it('should preserve nested block properties when wrapping rendered output', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const functionRegistry = createRenderFunctionRegistry('parent', 'child')
    const child = {
      ...createRenderBlock('child', { code: 'goal_title' }, 'compile_ast:child'),
      blockType: ComponentCallType.FIELD,
    }
    const parent = createRenderBlock('parent', { content: child }, 'compile_ast:parent')
    const task = createRenderBlocksTask([parent], renderer)

    // Act
    await executor.execute(task, new WorkContext(createRequestContext(false, functionRegistry)))

    // Assert
    expect(renderer.wrapNestedBlock).toHaveBeenCalledWith(
      {
        _forge: ComponentCallType.FIELD,
        variant: 'child',
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

  it('should pass the reconstructed block shape to a step renderer', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const evaluate = vi.fn(() => '<page>')
    const functionRegistry = new FunctionRegistry()
    const rendererInvocation = createRenderBlock('page', { layout: 'wide' }, 'compile_ast:page')
    const renderContext = {
      ...createRenderContext(),
      renderer: rendererInvocation,
    }
    const renderedBlockShape = {
      header: {
        block: { _forge: ComponentCallType.BASIC, variant: 'heading', text: 'Example' },
        html: '<h1>Example</h1>',
      },
      rows: [],
    }

    functionRegistry.register({
      page: {
        name: 'page',
        _forge: FunctionEntryType.RENDERER,
        evaluate,
      },
    })

    const requestContext = createRequestContext(false, functionRegistry)

    requestContext.recordRenderedBlocks(['<h1>Example</h1>'])
    requestContext.recordRenderedBlockShape(renderedBlockShape)

    const task = createAssemblePageTask(renderContext, renderer)

    // Act
    const result = await executor.execute(task, new WorkContext(requestContext))

    // Assert
    expect(result.output).toBe('<page>')
    expect(evaluate).toHaveBeenCalledWith({
      props: { layout: 'wide' },
      blocks: renderedBlockShape,
      context: {
        kind: 'step',
        step: renderContext.step,
        ancestors: renderContext.ancestors,
        routeTree: renderContext.routeTree,
        showValidationFailures: false,
        fieldValidationErrors: [],
        domainValidationErrors: [],
        answers: {},
        data: {},
      },
    })
  })

  it('should mark the block output with comment markers when the request is traced and the renderer supports it', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createMarkingRenderer()
    const functionRegistry = createRenderFunctionRegistry('known')
    const task = createRenderBlocksTask([createRenderBlock('known')], renderer)

    // Act
    const result = await executor.execute(task, new WorkContext(createRequestContext(true, functionRegistry)))

    // Assert
    expect(result.output).toEqual(['<!--forge:compile_ast:known--><known><!--/forge:compile_ast:known-->'])
    expect(renderer.markBlock).toHaveBeenCalledWith('compile_ast:known', '<known>')
  })

  it('should not mark the block output when the request is not traced', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createMarkingRenderer()
    const functionRegistry = createRenderFunctionRegistry('known')
    const task = createRenderBlocksTask([createRenderBlock('known')], renderer)

    // Act
    const result = await executor.execute(task, new WorkContext(createRequestContext(false, functionRegistry)))

    // Assert
    expect(result.output).toEqual(['<known>'])
    expect(renderer.markBlock).not.toHaveBeenCalled()
  })

  it('should not mark the block output when the renderer does not implement markBlock', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const functionRegistry = createRenderFunctionRegistry('known')
    const task = createRenderBlocksTask([createRenderBlock('known')], renderer)

    // Act
    const result = await executor.execute(task, new WorkContext(createRequestContext(true, functionRegistry)))

    // Assert
    expect(result.output).toEqual(['<known>'])
  })

  it('should render a Fragment as its nested blocks concatenated with no wrapper', async () => {
    // Arrange - a renderer matching the real contract: renderBlock invokes the
    // component's own render, wrapNestedBlock produces a RenderedBlock
    const executor = new WorkExecutor()
    const renderer: ForgeRenderer<string> = {
      wrapNestedBlock: (block: BlockDefinition, output: string) => ({ block, html: output }),
      assemblePage: (_context, renderedBlocks) => renderedBlocks.join(''),
    }
    const Child = component<{ text?: string }>('child', {
      factory:
        () =>
        ({ props }) =>
          `<p>${props.text}</p>`,
    })
    const functionRegistry = createFunctionRegistry([...builtInComponents, Child])
    const fragment = createRenderBlock('fragment', {
      blocks: [
        createRenderBlock('child', { text: 'one' }, 'compile_ast:child1'),
        createRenderBlock('child', { text: 'two' }, 'compile_ast:child2'),
      ],
    })
    const task = createRenderBlocksTask([fragment], renderer)

    // Act
    const result = await executor.execute(task, new WorkContext(createRequestContext(false, functionRegistry)))

    // Assert
    expect(result.output).toEqual(['<p>one</p><p>two</p>'])
  })
})

function createFunctionRegistry(entries: readonly FunctionEntry[]): FunctionRegistry {
  const registry = new FunctionRegistry()

  entries.forEach(entry => {
    if (entry.name === undefined) {
      throw new TypeError('Render function entry requires a name')
    }

    const name = entry.name

    registry.register({
      [name]: {
        ...entry,
        name,
        evaluate: entry.factory({}),
      },
    })
  })

  return registry
}
