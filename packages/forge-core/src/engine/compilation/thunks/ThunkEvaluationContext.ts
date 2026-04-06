import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { CompilationDependencies } from '../CompilationDependencies'
import { AnswerHistory } from './types'
import ThunkCacheManager from './ThunkCacheManager'
import type { StepRequest } from '../../../framework/types/request.type'
import type { StepResponse } from '../../../framework/types/response.type'
import { ValidationResult } from '../../nodes/expressions/validation/ValidationHandler'

export interface StepValidationFailure extends ValidationResult {
  blockId: NodeId
}

export type DomainValidationFailure = ValidationResult

export interface StepValidationState {
  stepId: NodeId
  validated: boolean
  isValid: boolean
  fieldFailures: StepValidationFailure[]
  domainFailures: DomainValidationFailure[]
}

export interface ReachabilityStep {
  path: string
  code?: string
  fieldCodes?: string[]
  cleardownFieldCodes?: string[]
  backPath?: string
}

export interface JourneyReachabilityState {
  reachableSteps: ReachabilityStep[]
  unreachableSteps: ReachabilityStep[]
}

/**
 * Global mutable state that persists across thunk evaluations
 */
export interface ThunkEvaluationGlobalState {
  data: Record<string, unknown>
  answers: Record<string, AnswerHistory>
  validation?: StepValidationState
  reachability?: JourneyReachabilityState
}

/**
 * Runtime evaluation context with scoped variable support
 *
 * Key features:
 * 1. Organized structure: request data, global state, and scoped variables clearly separated
 * 2. Lexical scoping: Support for nested collections and function contexts via scope stack
 * 3. Answer history: Track mutations to answers over the request lifecycle
 *
 * This design enables:
 * - Functions to receive contextual `value` parameters via scope
 * - Nested collections to safely reference parent collection items
 * - Prevention of context pollution across thunk invocations
 * - Delta queries via AnswerHistory.mutations
 */
export default class ThunkEvaluationContext {
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
  readonly scope: Record<string, unknown>[] = []

  constructor(
    private readonly compilationDependencies: CompilationDependencies,
    private readonly journeyInstanceDependencies: JourneyInstanceDependencies,
    readonly cacheManager: ThunkCacheManager,
    readonly request: StepRequest,
    readonly response: StepResponse,
    readonly global: ThunkEvaluationGlobalState = {
      data: {},
      answers: {},
    },
  ) {}

  get nodeRegistry() {
    return this.compilationDependencies.nodeRegistry
  }

  get logger() {
    return this.journeyInstanceDependencies.logger
  }

  get functionRegistry() {
    return this.journeyInstanceDependencies.functionRegistry
  }

  get metadataRegistry() {
    return this.compilationDependencies.metadataRegistry
  }

  get astNodeTree() {
    return this.compilationDependencies.astNodeTree
  }

  /**
   * Create a clone of this context with an isolated scope snapshot
   *
   * The cloned context shares:
   * - global state (answers, data) - mutations are shared
   * - response mutations (headers, cookies) - mutations are shared
   * - request data
   * - dependencies (nodeRegistry, functionRegistry, logger)
   *
   * But has its own:
   * - scope array (shallow copy of current scope stack)
   *
   * This enables parallel evaluations to have isolated scope stacks
   * while still sharing global mutable state and response mutations.
   */
  withIsolatedScope(): ThunkEvaluationContext {
    const clone = new ThunkEvaluationContext(
      this.compilationDependencies,
      this.journeyInstanceDependencies,
      this.cacheManager,
      this.request,
      this.response,
      this.global,
    )

    // Copy current scope stack (shallow copy - each scope object is shared)
    clone.scope.push(...this.scope)

    return clone
  }
}
