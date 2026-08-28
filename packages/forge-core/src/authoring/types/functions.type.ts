import type { ZodType } from 'zod'
import type { FunctionEntryType } from '../../shared/taxonomy'

/**
 * The callable implementation of a registered function, with its dependencies
 * already applied. For conditions, transformers, and effects the first
 * argument is the injected value (or effect context) and the remaining
 * arguments are the authored ones; generators receive only the authored
 * arguments.
 */
export type FunctionEvaluator<T = any> = (...args: any[]) => T

/**
 * A runtime registry entry for one registered function, as consumed by the
 * engine. Usually produced by `build()` on a {@link BaseFunctionRegistry}
 * subclass rather than written by hand.
 */
export interface FunctionRegistryEntry {
  /** Registry key the function is looked up by when expressions call it. */
  name: string

  /** The implementation to call. */
  evaluate: FunctionEvaluator

  /**
   * Whether {@link evaluate} is an async function. Decides whether compiled
   * expressions await the call, so it must be accurate; `build()` detects it
   * from the function itself.
   */
  isAsync: boolean

  /**
   * Validates the injected value before {@link evaluate} runs. A failing
   * value makes a condition evaluate to `false` (a wrongly-shaped field is
   * a normal "not valid yet" outcome); for any other kind a failure throws.
   */
  inputSchema?: ZodType

  /**
   * Validates the authored arguments (excluding the injected value) before
   * {@link evaluate} runs, and drives arity checking at compilation. A
   * failure always throws: bad arguments are an authoring mistake.
   */
  argumentsSchema?: ZodType

  /**
   * Validates the return value of {@link evaluate}. A failure throws.
   */
  outputSchema?: ZodType

  /**
   * Which kind of function this is. Decides whether a value is injected as
   * the first argument and how schema failures short-circuit.
   */
  _forge?: FunctionEntryType
}

/**
 * Registry entries keyed by function name: the shape the engine resolves
 * function calls against, and what `build()` on a registry returns.
 */
export type FunctionRegistryObject = Record<string, FunctionRegistryEntry>

/**
 * The contract the engine consumes custom functions through: anything that can
 * build registry rows from dependencies at registration time. Satisfied by
 * `BaseFunctionRegistry` subclasses and by the entry registry that
 * `createForgePackage()` assembles from function entries.
 */
export interface FunctionRegistryBuilder<TDeps = any> {
  build(deps?: TDeps): FunctionRegistryObject
}

/**
 * The registration surface of a function entry created by helpers such as
 * `condition()`. Structural rather than the concrete entry shape so the
 * engine can consume entries without depending on the authoring helpers.
 */
export interface FunctionEntry<TDeps = any> {
  /** The author-given name, or undefined for an anonymous entry. */
  readonly name: string | undefined

  /** Which function table the entry belongs to. */
  readonly _forge: FunctionEntryType

  /** Validates the injected value, where declared. */
  readonly inputSchema?: ZodType

  /** Validates the authored arguments, where declared. */
  readonly argumentsSchema?: ZodType

  /** Validates the evaluator's result, where declared. */
  readonly outputSchema?: ZodType

  /** Builds the evaluator from the dependencies supplied at registration time. */
  readonly factory: (deps: TDeps) => FunctionEvaluator
}
