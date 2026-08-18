import { BaseFunctionRegistry } from '../authoring/registries/BaseFunctionRegistry'
import { GeneratorBuilder } from '../authoring/builders/GeneratorBuilder'
import type { ChainableGenerator } from '../authoring/builders/types'
import { FunctionType } from '../authoring/types/enums'
import type {
  ConditionFunctionExpr,
  EffectFunctionExpr,
  GeneratorFunctionExpr,
  TransformerFunctionExpr,
} from '../authoring/types/expressions.type'
import type { FunctionRegistryEntry } from '../authoring/types/functions.type'
import type { EffectFunctionContext } from '../engine/chassis/runtime/context/EffectFunctionContext'
import {
  precheckShortCircuit,
  validateOutput,
} from '../engine/chassis/compilation/lowering/generatedFunctionRuntimeLibrary'

/**
 * Unit-tests functions registered in a `ConditionRegistry`, `TransformerRegistry`,
 * `EffectRegistry`, or `GeneratorRegistry` through the engine's real evaluation
 * pipeline — schema prechecks, short-circuits, and output validation — rather than
 * calling the raw evaluator and bypassing all of it.
 *
 * Pass the value returned by the author-facing handle that `register(...)` gives
 * back. `evaluate` then supplies the argument the engine injects at runtime:
 * `withInput` for conditions and transformers, `withContext` for effects.
 * Generators take no injected argument, so `evaluate` runs them immediately.
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
 */
export class FunctionRegistryTestHarness<TDeps = Record<string, never>> {
  private readonly entries = new Map<string, FunctionRegistryEntry>()

  constructor(functions: BaseFunctionRegistry<TDeps> | BaseFunctionRegistry<TDeps>[], deps?: TDeps) {
    const registries = Array.isArray(functions) ? functions : [functions]

    registries.forEach(registry => {
      const built = registry.build(deps)

      Object.values(built).forEach(entry => {
        if (this.entries.has(entry.name)) {
          throw new Error(`Function "${entry.name}" is registered in more than one registry passed to this harness`)
        }

        this.entries.set(entry.name, entry)
      })
    })
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
    const entry = this.lookup(functionExpr.name)

    if (functionExpr.type === FunctionType.EFFECT) {
      return {
        withContext: (context: EffectFunctionContext) => this.execute(entry, [context, ...functionExpr.arguments]),
      }
    }

    if (functionExpr.type === FunctionType.GENERATOR) {
      return this.execute(entry, [...functionExpr.arguments])
    }

    return {
      withInput: (value: unknown) => this.execute(entry, [value, ...functionExpr.arguments]),
    }
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

    if (entry.isAsync) {
      return (result as Promise<unknown>).then(resolved => {
        validateOutput(entry, entry.name, resolved)

        return resolved
      })
    }

    validateOutput(entry, entry.name, result)

    return result
  }
}
