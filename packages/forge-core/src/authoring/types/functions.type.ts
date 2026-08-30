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
  /** Internal Forge discriminator. Do not set or override this property. */
  _forge?: FunctionEntryType

  /** Field metadata carried by component entries. */
  multiple?: boolean

  /** Field metadata carried by component entries. */
  errorAnchor?: FunctionEvaluator<string | undefined>
}

/** A request-bound presentation evaluator, narrowed after registry lookup. */
export interface PresentationFunctionRegistryEntry extends FunctionRegistryEntry {
  readonly _forge: FunctionEntryType.COMPONENT | FunctionEntryType.RENDERER
}

/**
 * Registry entries keyed by function name: the shape the engine resolves
 * function calls against, and what `build()` on a registry returns.
 */
export type FunctionRegistryObject = Record<string, FunctionRegistryEntry>

/**
 * An unbound function definition used to validate and compile a package
 * without invoking its factory.
 */
export interface FunctionDefinition<TDeps = unknown> {
  readonly name: string
  readonly factory: (dependencies: TDeps) => FunctionEvaluator
  readonly inputSchema?: ZodType
  readonly argumentsSchema?: ZodType
  readonly outputSchema?: ZodType
  readonly _forge?: FunctionEntryType
  readonly multiple?: boolean
  readonly errorAnchor?: FunctionEvaluator<string | undefined>
}

/** Function definitions keyed by their package-scoped registry name. */
export type FunctionDefinitionObject<TDeps = unknown> = Record<string, FunctionDefinition<TDeps>>

/** The function metadata lookup required by package validation and compilation. */
export interface FunctionDefinitionLookup {
  get(name: string): Omit<FunctionRegistryEntry, 'evaluate'> | undefined
  has(name: string): boolean
}

/**
 * The contract the engine consumes custom functions through: anything that can
 * expose definitions for package compilation and build request-owned registry
 * rows from the dependencies resolved for one request. Satisfied by
 * `BaseFunctionRegistry` subclasses and by the entry registry that
 * `createForgePackage()` assembles from function entries.
 */
export interface FunctionRegistryBuilder<TDeps = any> {
  getDefinitions(): FunctionDefinitionObject<TDeps>
  build(dependencies?: TDeps): FunctionRegistryObject
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
  /** Internal Forge discriminator. Do not set or override this property. */
  readonly _forge: FunctionEntryType

  /** Validates the injected value, where declared. */
  readonly inputSchema?: ZodType

  /** Validates the authored arguments, where declared. */
  readonly argumentsSchema?: ZodType

  /** Validates the evaluator's result, where declared. */
  readonly outputSchema?: ZodType

  /** Field metadata carried by component entries. */
  readonly multiple?: boolean

  /** Field metadata carried by component entries. */
  readonly errorAnchor?: FunctionEvaluator<string | undefined>

  /** Builds one request's evaluator from its resolved dependencies. */
  readonly factory: (dependencies: TDeps) => FunctionEvaluator
}
