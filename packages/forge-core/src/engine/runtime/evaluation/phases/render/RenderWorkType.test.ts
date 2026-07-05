import { describe, expect, it, vi } from 'vitest'
import { BlockType, StructureType } from '../../../../../authoring/types/enums'
import { buildComponent } from '../../../../../components/utils/buildComponent'
import type { BlockDefinition, EvaluatedBlock } from '../../../../../components/types/structures.type'
import type { ForgeRenderer, RenderBlock, RenderContext } from '../../../../../framework/rendering/types'
import ComponentRegistry from '../../../../registries/ComponentRegistry'
import { RENDER_BLOCK_BRAND } from '../../../../contracts/compiled/renderBlock.brand'
import WorkContext from '../../work/WorkContext'
import WorkExecutor from '../../work/WorkExecutor'
import WorkTaskFactory from '../../work/WorkTaskFactory'
import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'

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

function createRequestContext(): RequestExecutionContext {
  return {
    context: {
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
    responseBindings: {
      setHeader: vi.fn(),
      setCookie: vi.fn(),
    },
    functionRegistry: { get: vi.fn() } as unknown as RequestExecutionContext['functionRegistry'],
    componentRegistry: new ComponentRegistry(),
    hasRenderer: true,
    buildStepValidation: () => undefined,
    recordStepValidation: () => {},
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
    const task = WorkTaskFactory.renderBlocks([createRenderBlock('missing')], renderer, componentRegistry)

    // Act / Assert
    await expect(executor.execute(task, new WorkContext(createRequestContext()))).rejects.toThrow(
      '[Forge] Component variant "missing" is not registered',
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
    const task = WorkTaskFactory.renderBlocks([parent], renderer, componentRegistry)

    // Act / Assert
    await expect(executor.execute(task, new WorkContext(createRequestContext()))).rejects.toThrow(
      '[Forge] Component variant "missing" is not registered',
    )
  })

  it('should render nested blocks before rendering the parent block', async () => {
    // Arrange
    const executor = new WorkExecutor()
    const renderer = createRenderer()
    const componentRegistry = createComponentRegistry('parent', 'child')
    const child = createRenderBlock('child', {}, 'compile_ast:child')
    const parent = createRenderBlock('parent', { content: child }, 'compile_ast:parent')
    const task = WorkTaskFactory.renderBlocks([parent], renderer, componentRegistry)
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
    const task = WorkTaskFactory.renderBlocks([parent], renderer, componentRegistry)

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
    requestContext.renderedBlocks = ['<one>', '<two>']
    const task = WorkTaskFactory.assemblePage(renderContext, renderer)

    // Act
    const result = await executor.execute(task, new WorkContext(requestContext))

    // Assert
    expect(result.output).toBe('<one><two>')
    expect(renderer.assemblePage).toHaveBeenCalledWith(renderContext, ['<one>', '<two>'], {})
  })
})
