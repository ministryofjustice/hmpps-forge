import type { BlockDefinition, FieldBlockDefinition } from '../../components/types/structures.type'
import type { NodeId } from '../../engine/chassis/contracts/ast/ast.type'
import type { RuntimeContext } from '../../engine/chassis/contracts/runtime/evaluationState.type'
import WorkContext from '../../engine/chassis/work/WorkContext'
import WorkExecutor from '../../engine/chassis/work/WorkExecutor'
import { createTestRequestState } from '../../engine/chassis/runtime/pipeline/testing-helpers/requestStateTestHelpers'
import { RENDER_BLOCK_BRAND } from '../../engine/concerns/render/contracts/renderBlock.brand'
import { createRenderBlocksTask } from '../../engine/concerns/render/runtime/RenderBlocksWorkHandler'
import type { ForgeRenderer, RenderBlock, RenderContext } from '../../framework/types/rendering.type'
import { ComponentCallType, FunctionEntryType } from '../../shared/taxonomy'
import type { FunctionEntry } from '../../authoring/types/functions.type'
import FunctionRegistry from '../../engine/chassis/registries/FunctionRegistry'

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
 * const harness = new ComponentTestHarness(MyCard, dependencies)
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
export class ComponentTestHarness {
  private readonly functionRegistry: FunctionRegistry

  private readonly renderer: ForgeRenderer<unknown>

  private nextBlockNumber = 1

  constructor(components: FunctionEntry | readonly FunctionEntry[], dependencies?: object) {
    this.functionRegistry = new FunctionRegistry()
    const entries = Array.isArray(components) ? [...components] : [components]
    const renderDefinitions = entries.filter(isRenderDefinition)

    renderDefinitions.forEach(definition => {
      this.functionRegistry.register({
        [definition.name]: {
          ...definition,
          name: definition.name,
          evaluate: definition.factory(dependencies ?? {}),
        },
      })
    })
    this.renderer = this.createRenderer()
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
    const task = createRenderBlocksTask([renderBlock], this.renderer)
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
        'ComponentTestHarness requires concrete component props. ' +
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
      functionRegistry: this.functionRegistry,
      hasRenderer: true,
    })
  }

  private createRenderer(): ForgeRenderer<unknown> {
    return {
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

function isRenderDefinition(value: FunctionEntry): value is FunctionEntry & { readonly name: string } {
  return value._forge === FunctionEntryType.COMPONENT &&
    typeof value.factory === 'function' &&
    typeof value.name === 'string'
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
