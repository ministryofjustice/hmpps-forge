import { BaseFunctionRegistry } from '../../authoring/registries/BaseFunctionRegistry'
import { isFunctionEntry } from '../../authoring/functions/createEntry'
import { getEntryStamp } from '../../authoring/builders/utils/stampEntry'
import { FunctionEntryRegistry } from '../../authoring/functions/FunctionEntryRegistry'
import { GeneratorBuilder } from '../../authoring/builders/GeneratorBuilder'
import type { ChainableGenerator } from '../../authoring/builders/types'
import { ComponentCallType, FunctionCallType } from '../../shared/taxonomy'
import type {
  ConditionFunctionExpr,
  EffectFunctionExpr,
  GeneratorFunctionExpr,
  TransformerFunctionExpr,
} from '../../authoring/types/expressions.type'
import type { FunctionEntry, FunctionRegistryEntry } from '../../authoring/types/functions.type'
import type { EffectFunctionContext } from '../../engine/chassis/runtime/context/EffectFunctionContext'
import type { BlockDefinition, FieldBlockDefinition } from '../../components/types/structures.type'
import type { NodeId } from '../../engine/chassis/contracts/ast/ast.type'
import type { RuntimeContext } from '../../engine/chassis/contracts/runtime/evaluationState.type'
import WorkContext from '../../engine/chassis/work/WorkContext'
import WorkExecutor from '../../engine/chassis/work/WorkExecutor'
import { createTestRequestState } from '../../engine/chassis/runtime/pipeline/testing-helpers/requestStateTestHelpers'
import { RENDER_BLOCK_BRAND } from '../../engine/concerns/render/contracts/renderBlock.brand'
import { createRenderBlocksTask } from '../../engine/concerns/render/runtime/RenderBlocksWorkHandler'
import type { ForgeRenderer, RenderBlock, RenderContext } from '../../framework/types/rendering.type'
import FunctionRegistry from '../../engine/chassis/registries/FunctionRegistry'
import {
  isThenable,
  precheckShortCircuit,
  validateOutput,
} from '../../engine/chassis/compilation/lowering/generatedFunctionRuntimeLibrary'

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
 * Unit-tests any Forge function entry through its real runtime boundary rather
 * than calling a raw evaluator. Conditions, transformers, generators, and effects
 * use the compiled-function checks; components use the recursive render pipeline.
 *
 * Pass the value returned by the author-facing handle that `register(...)` gives
 * back. `evaluate` then supplies the argument the engine injects at runtime:
 * `withInput` for conditions and transformers, `withContext` for effects.
 * Generators take no injected argument, so `evaluate` runs them immediately.
 * Component calls use `render`; field values and errors are supplied through
 * `withValue` on the returned field invocation.
 *
 * @example
 * ```typescript
 * const conditions = new ConditionRegistry()
 * const isRequired = conditions.register('isRequired', { factory: () => (value) => value != null })
 *
 * const harness = new FunctionRegistryTestHarness(conditions)
 * expect(harness.evaluate(isRequired()).withInput('hello')).toBe(true)
 * expect(harness.evaluate(isRequired()).withInput(undefined)).toBe(false)
 * ```
 *
 * @example
 * ```typescript
 * const effects = new EffectRegistry()
 * const stamp = effects.register('stamp', { factory: () => (context) => context.setAnswer('stamped', true) })
 *
 * const context = createTestEffectContext()
 * new FunctionRegistryTestHarness(effects).evaluate(stamp()).withContext(context)
 * expect(context.getAnswer('stamped')).toBe(true)
 * ```
 *
 * @example
 * ```typescript
 * const harness = new FunctionRegistryTestHarness(MyCard, dependencies)
 * const output = await harness.render(MyCard({ title: 'Details' }))
 * ```
 */
export class FunctionRegistryTestHarness<TDeps = Record<string, never>> {
  private readonly entries = new Map<string, FunctionRegistryEntry>()

  private readonly entryNames = new Map<FunctionEntry, string>()

  private readonly functionRegistry = new FunctionRegistry()

  private readonly renderer: ForgeRenderer<unknown>

  private nextBlockNumber = 1

  constructor(
    functions: BaseFunctionRegistry<TDeps> | FunctionEntry | (BaseFunctionRegistry<TDeps> | FunctionEntry)[],
    deps?: TDeps,
  ) {
    const sources = Array.isArray(functions) ? functions : [functions]
    const entryRegistry = new FunctionEntryRegistry<TDeps>()

    sources.forEach(source => {
      if (isFunctionEntry(source)) {
        this.entryNames.set(source, entryRegistry.collect(source))

        return
      }

      const built = (source as BaseFunctionRegistry<TDeps>).build(deps)

      Object.values(built).forEach(entry => this.add(entry))
    })

    Object.values(entryRegistry.build(deps)).forEach(entry => this.add(entry))
    this.renderer = this.createRenderer()
  }

  evaluate(expr: GeneratorFunctionExpr | ChainableGenerator): unknown

  evaluate(expr: ConditionFunctionExpr): { withInput(value: unknown): unknown }

  evaluate(expr: TransformerFunctionExpr): { withInput(value: unknown): unknown }

  evaluate(expr: EffectFunctionExpr): { withContext(context: EffectFunctionContext): unknown }

  evaluate(
    expr:
      | GeneratorFunctionExpr
      | ChainableGenerator
      | ConditionFunctionExpr
      | TransformerFunctionExpr
      | EffectFunctionExpr,
  ): unknown {
    const functionExpr =
      expr instanceof GeneratorBuilder ? expr.build() : (expr as Exclude<typeof expr, ChainableGenerator>)
    // Expressions from same-named entries carry identical names until the
    // engine's finalisation walk renames them, so resolve by the entry stamp
    // when one is present and fall back to the name for registry handles.
    const stampedEntry = getEntryStamp(functionExpr) as FunctionEntry | undefined
    const entry = this.lookup((stampedEntry && this.entryNames.get(stampedEntry)) ?? functionExpr.name)

    if (functionExpr._forge === FunctionCallType.EFFECT) {
      return {
        withContext: (context: EffectFunctionContext) => this.execute(entry, [context, ...functionExpr.arguments]),
      }
    }

    if (functionExpr._forge === FunctionCallType.GENERATOR) {
      return this.execute(entry, [...functionExpr.arguments])
    }

    return {
      withInput: (value: unknown) => this.execute(entry, [value, ...functionExpr.arguments]),
    }
  }

  render(block: FieldBlockDefinition): FieldComponentTestInvocation

  render(block: BlockDefinition): Promise<unknown>

  render(block: BlockDefinition): Promise<unknown> | FieldComponentTestInvocation {
    if (block._forge === ComponentCallType.FIELD) {
      return {
        withValue: (value, errors) => this.executeComponent(block, { value, errors }),
      }
    }

    return this.executeComponent(block)
  }

  private add(entry: FunctionRegistryEntry): void {
    if (this.entries.has(entry.name)) {
      throw new Error(`Function "${entry.name}" is registered in more than one registry passed to this harness`)
    }

    this.entries.set(entry.name, entry)
    this.functionRegistry.register({ [entry.name]: entry })
  }

  private lookup(name: string): FunctionRegistryEntry {
    const entry = this.entries.get(name)

    if (entry === undefined) {
      const registered = [...this.entries.keys()].sort().join(', ')

      throw new Error(`Function "${name}" is not registered in this harness. Registered functions: ${registered}`)
    }

    return entry
  }

  private execute(entry: FunctionRegistryEntry, args: unknown[]): unknown {
    const shortCircuit = precheckShortCircuit(entry, entry.name, args)

    if (shortCircuit !== undefined) {
      return shortCircuit.value
    }

    const result = entry.evaluate(...args)

    if (isThenable(result)) {
      return Promise.resolve(result).then(resolved => {
        validateOutput(entry, entry.name, resolved)

        return resolved
      })
    }

    validateOutput(entry, entry.name, result)

    return result
  }

  private async executeComponent(block: BlockDefinition, fieldRuntimeProps?: FieldRuntimeProps): Promise<unknown> {
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
    const stampedEntry = getEntryStamp(block) as FunctionEntry | undefined
    const variant = (stampedEntry && this.entryNames.get(stampedEntry)) ?? block.variant

    if (fieldRuntimeProps !== undefined) {
      properties.value = fieldRuntimeProps.value

      if (fieldRuntimeProps.errors !== undefined) {
        properties.errors = fieldRuntimeProps.errors
      }
    }

    return {
      [RENDER_BLOCK_BRAND]: true,
      id: this.nextBlockId(),
      variant,
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
        'FunctionRegistryTestHarness requires concrete component props. ' +
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
