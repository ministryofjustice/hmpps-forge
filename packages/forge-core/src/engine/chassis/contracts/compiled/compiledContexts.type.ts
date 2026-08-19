import type FunctionRegistry from '../../registries/FunctionRegistry'
import type { ComponentRegistry } from '../../../../framework/types/adapter.type'
import type { ValidationResult } from '../../../concerns/validation/contracts/validationResult.type'

/**
 * The answer snapshot the generated source reads at the compiled-function boundary:
 * the current value plus the parsed value and mutation sources produced by compiled
 * answer preparation. The live runtime value is the richer `AnswerHistory`, which
 * assigns to this; the boundary stays deliberately loose (only generated source
 * reads these fields, never type-checked code).
 */
interface CompiledAnswerSnapshot {
  current: unknown
  parsed?: unknown
  mutations?: { value: unknown; source: string }[]
}

/**
 * The answer snapshot after compiled answer preparation has run — `mutations` is
 * guaranteed present, since the answer-preparation phase is the one that produces it.
 */
interface CompiledPreparedAnswer extends CompiledAnswerSnapshot {
  mutations: { value: unknown; source: string }[]
}

/**
 * The shared shape every compiled-function context carries. Compiled functions
 * deliberately receive a small snapshot of request state instead of the full
 * RuntimeEvaluationGlobalState, so the generated-function boundary stays explicit.
 *
 * `request`/`session`/`params`/`query` are intentionally loose: only the generated
 * source reads their concrete fields, never type-checked code. `workTasks` is
 * intentionally loose for the same reason — generated source reads it to build
 * tasks; no type-checked code does.
 */
export interface CompiledBaseContext {
  answers: Record<string, CompiledAnswerSnapshot>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
  workTasks: unknown
}

/**
 * Context passed to the compiled validation function.
 */
export type CompiledValidationContext = CompiledBaseContext

/**
 * Context passed to the compiled render function. Field value resolution reads the
 * AnswerHistory produced by compiled answer preparation, including parsed values
 * and mutation sources. `fieldFailures` is keyed by render block ID, not field code.
 * Block resolution records each failing field block's document anchor (the
 * component's declared `errorAnchor`, or the field code) into
 * `fieldFailureAnchors`, also keyed by render block ID, so the error summary can
 * link to the right block instance. `components` is how the anchor is derived -
 * the failing block's registry entry declares where focus should land.
 */
export interface CompiledResolveContext extends CompiledBaseContext {
  post: Record<string, unknown>
  fieldFailures: Record<string, ValidationResult[]>
  fieldFailureAnchors: Record<string, string>
  components: ComponentRegistry
}

/**
 * Context passed to the compiled answer preparation function.
 *
 * Answer preparation mutates ctx.answers in place. That is intentional: hooks,
 * validation, reachability, and render all run against the same request context
 * and need to observe the same answer history.
 */
export interface CompiledAnswerPreparationContext extends CompiledBaseContext {
  answers: Record<string, CompiledPreparedAnswer>
  post: Record<string, unknown>
  components: ComponentRegistry
}

/**
 * Context passed to the compiled reachability facts function. Reachability
 * expressions run at journey scope, so no iterator scope stack is needed here.
 * There is no dedicated builder — the reachability expressions run inline inside
 * the generated facts function, against this context.
 */
export type CompiledReachabilityContext = CompiledBaseContext

/**
 * Context passed to the package-level compiled route-metadata function. Route
 * metadata expressions (title/description/metadata) are evaluated once per
 * request against the same base snapshot every other compiled function sees.
 */
export type CompiledRouteMetadataContext = CompiledBaseContext
