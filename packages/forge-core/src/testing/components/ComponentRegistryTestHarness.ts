import type { ComponentRegistryEntry } from '../../components/types/components.type'
import type { BlockDefinition, FieldBlockDefinition } from '../../components/types/structures.type'
import type { NodeId } from '../../engine/chassis/contracts/ast/ast.type'
import type { RuntimeContext } from '../../engine/chassis/contracts/runtime/evaluationState.type'
import ComponentRegistry from '../../engine/chassis/registries/ComponentRegistry'
import WorkContext from '../../engine/chassis/work/WorkContext'
import WorkExecutor from '../../engine/chassis/work/WorkExecutor'
import { createTestRequestState } from '../../engine/chassis/runtime/pipeline/testing-helpers/requestStateTestHelpers'
import { RENDER_BLOCK_BRAND } from '../../engine/concerns/render/contracts/renderBlock.brand'
import { createRenderBlocksTask } from '../../engine/concerns/render/runtime/RenderBlocksWorkHandler'
import type { ForgeRenderer, RenderBlock, RenderContext, ResolvedBlock } from '../../framework/types/rendering.type'
import { ComponentCallType } from '../../shared/taxonomy'

const COMPONENT_ENVELOPE_KEYS = new Set(['_forge', 'variant'])

const FIELD_AUTHORING_KEYS = new Set(['defaultValue', 'formatters', 'parsers', 'validWhen', 'dependentWhen'])

export interface ComponentTestError {
  readonly message: string
  readonly details?: Record<string, unknown>
}

export interface FieldComponentTestInvocation {
  withValue(value: unknown, errors?: readonly ComponentTestError[]): Promise<unknown>
}

interface FieldRuntimeProps {
  readonly value: unknown
  readonly errors?: readonly ComponentTestError[]
}

/**
 * Unit-tests registered components through Forge's real recursive rendering
 * pipeline. Pass the author-facing block returned by a component handle; the
 * harness looks up the registered entry, renders nested blocks first, wraps
 * their output, and then renders the parent.
 *
 * Component tests use concrete authored values. Expression evaluation belongs
 * in {@link ForgeTestHarness}, where answers, data, request state and registered
 * functions are available.
 *
 * @example
 * ```typescript
 * const harness = new ComponentRegistryTestHarness(MyCard, renderer)
 * const output = await harness.render(MyCard({ title: 'Details' }))
 * ```
 *
 * Field values are supplied the same way function inputs are supplied to
 * `FunctionRegistryTestHarness`:
 *
 * ```typescript
 * const output = await harness
 *   .render(MyTextInput({ code: 'name', label: 'Name' }))
 *   .withValue('Ada')
 * ```
 */
export class ComponentRegistryTestHarness {
  private readonly componentRegistry: ComponentRegistry

  private readonly renderer: ForgeRenderer<unknown>

  private nextBlockNumber = 1

  constructor(
    components: ComponentRegistryEntry<object, unknown> | readonly ComponentRegistryEntry<object, unknown>[],
    componentRenderer?: unknown,
  ) {
    this.componentRegistry = new ComponentRegistry()
    this.componentRegistry.registerMany(Array.isArray(components) ? [...components] : [components])
    this.renderer = this.createRenderer(componentRenderer)
  }

  render(block: FieldBlockDefinition): FieldComponentTestInvocation

  render(block: BlockDefinition): Promise<unknown>

  render(block: BlockDefinition): Promise<unknown> | FieldComponentTestInvocation {
    if (block._forge === ComponentCallType.FIELD) {
      return {
        withValue: (value, errors) => this.execute(block, { value, errors }),
      }
    }

    return this.execute(block)
  }

  private async execute(block: BlockDefinition, fieldRuntimeProps?: FieldRuntimeProps): Promise<unknown> {
    const renderBlock = this.toRenderBlock(block, fieldRuntimeProps)
    const task = createRenderBlocksTask([renderBlock], this.renderer, this.componentRegistry)
    const result = await new WorkExecutor(false).execute(task, new WorkContext(this.createRequestState()))

    if (!Array.isArray(result.output)) {
      throw new TypeError('Component rendering completed without an output array')
    }

    return result.output[0]
  }

  private toRenderBlock(block: BlockDefinition, fieldRuntimeProps?: FieldRuntimeProps): RenderBlock {
    const properties = this.toRenderProperties(block)

    if (fieldRuntimeProps !== undefined) {
      properties.value = fieldRuntimeProps.value

      if (fieldRuntimeProps.errors !== undefined) {
        properties.errors = fieldRuntimeProps.errors
      }
    }

    return {
      [RENDER_BLOCK_BRAND]: true,
      id: this.nextBlockId(),
      variant: block.variant,
      blockType: block._forge,
      properties,
    }
  }

  private toRenderProperties(block: BlockDefinition): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(block)
        .filter(([key]) => !COMPONENT_ENVELOPE_KEYS.has(key))
        .filter(([key]) => block._forge !== ComponentCallType.FIELD || !FIELD_AUTHORING_KEYS.has(key))
        .map(([key, value]) => [key, this.toRenderValue(value)]),
    )
  }

  private toRenderValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.toRenderValue(item))
    }

    if (!isRecord(value)) {
      return value
    }

    if (isBlockDefinition(value)) {
      return this.toRenderBlock(value)
    }

    if (typeof value._forge === 'string') {
      throw new TypeError(
        'ComponentRegistryTestHarness requires concrete component props. ' +
          'Use ForgeTestHarness when testing expression evaluation.',
      )
    }

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.toRenderValue(item)]))
  }

  private nextBlockId(): NodeId {
    const blockNumber = this.nextBlockNumber
    this.nextBlockNumber += 1

    return `compiled:component-test-${blockNumber}`
  }

  private createRequestState() {
    const context: RuntimeContext = {
      request: {
        url: '/component-test',
        path: '/component-test',
        method: 'GET',
        location: {
          origin: 'https://component.test',
          href: 'https://component.test/component-test',
          pathname: '/component-test',
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
    }

    return createTestRequestState(context, {
      componentRegistry: this.componentRegistry,
      hasRenderer: true,
    })
  }

  private createRenderer(componentRenderer?: unknown): ForgeRenderer<unknown> {
    return {
      renderBlock: (entry: ComponentRegistryEntry<object, unknown>, block: ResolvedBlock) =>
        entry.render(block, componentRenderer),
      wrapNestedBlock: (block: BlockDefinition, output: unknown) => {
        if (typeof output === 'string') {
          return { block, html: output }
        }

        return { block, output }
      },
      assemblePage: (_context: RenderContext, renderedBlocks: readonly unknown[]) => renderedBlocks[0],
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isBlockDefinition(value: unknown): value is BlockDefinition {
  if (!isRecord(value)) {
    return false
  }

  return (value._forge === ComponentCallType.BASIC || value._forge === ComponentCallType.FIELD) &&
    typeof value.variant === 'string'
}
