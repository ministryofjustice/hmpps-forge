import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import { CompilationDependencies } from '@form-engine/core/ast/compilation/CompilationDependencies'
import { EvaluatorRequestData } from '@form-engine/core/ast/thunks/types'

/**
 * Global mutable state that persists across thunk evaluations
 */
export interface ThunkEvaluationGlobalState {
  data: Record<string, unknown>
  answers: Record<string, unknown>
}

/**
 * Runtime evaluation context with scoped variable support
 *
 * Key improvements over ThunkEvaluationContext:
 * 1. Organized structure: request data, global state, and scoped variables clearly separated
 * 2. Lexical scoping: Support for nested collections and function contexts via scope stack
 * 3. Unified lookup: getValue() method provides convenient access to scoped and global variables
 *
 * This design enables:
 * - Functions to receive contextual `value` parameters via scope
 * - Nested collections to safely reference parent collection items
 * - Prevention of context pollution across thunk invocations
 */
export default class ThunkEvaluationContext {
  /**
   * Global mutable state
   *
   * Contains state that persists across all thunk evaluations:
   * - data: External data loaded via onLoad transitions
   * - answers: Resolved field answers (maps field codes to values)
   *
   * Both properties are mutable and populated during evaluation.
   */
  readonly global: ThunkEvaluationGlobalState

  /**
   * Scoped variables (lexically scoped)
   *
   * Stack of scope levels where the last element is the current scope.
   * Each scope contains variables local to that invocation context:
   * - Collection iteration: { '@value': item, '@index': index, ...itemProperties }
   * - Function invocation: { '@value': parameter }
   *
   * Child scopes inherit from parent scopes (lexical scoping).
   * Access via:
   * - Direct: context.scope[context.scope.length - 1].someVar
   * - Unified: context.getValue('someVar') // Checks scope chain then global
   *
   * Scope management:
   * - Push scope before entering collection iteration or function call
   * - Pop scope when exiting
   */
  readonly scope: Record<string, unknown>[]

  constructor(
    private readonly compilationDependencies: CompilationDependencies,
    private readonly formInstanceDependencies: FormInstanceDependencies,
    readonly request: EvaluatorRequestData,
    global?: ThunkEvaluationGlobalState,
  ) {
    this.global = global ?? {
      data: {},
      answers: {},
    }

    this.scope = []
  }

  get nodeRegistry() {
    return this.compilationDependencies.nodeRegistry
  }

  get logger() {
    return this.formInstanceDependencies.logger
  }

  get functionRegistry() {
    return this.formInstanceDependencies.functionRegistry
  }

  get metadataRegistry() {
    return this.compilationDependencies.metadataRegistry
  }

  /**
   * Create a clone of this context with an isolated scope snapshot
   *
   * The cloned context shares:
   * - global state (answers, data) - mutations are shared
   * - request data
   * - dependencies (nodeRegistry, functionRegistry, logger)
   *
   * But has its own:
   * - scope array (shallow copy of current scope stack)
   *
   * This enables parallel evaluations to have isolated scope stacks
   * while still sharing global mutable state.
   */
  withIsolatedScope(): ThunkEvaluationContext {
    const clone = new ThunkEvaluationContext(
      this.compilationDependencies,
      this.formInstanceDependencies,
      this.request,
      this.global,
    )

    // Copy current scope stack (shallow copy - each scope object is shared)
    clone.scope.push(...this.scope)

    return clone
  }
}
