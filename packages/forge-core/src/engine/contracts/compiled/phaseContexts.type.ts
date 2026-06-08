import type FunctionRegistry from '../../registries/FunctionRegistry'

export interface BasePhaseContext {
  answers: Record<string, { current: unknown }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
}

export type ValidationContext = BasePhaseContext

/**
 * Runtime context passed to the compiled render function.
 * Field value resolution reads the AnswerHistory produced by compiled answer
 * preparation, including parsed values and mutation sources.
 */
export interface RenderCompilationContext {
  answers: Record<string, { current: unknown; parsed?: unknown; mutations?: { source: string; value: unknown }[] }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  post: Record<string, string | string[]>
  request: Record<string, unknown>
  conditions: FunctionRegistry
}

/**
 * Runtime context passed to the compiled answer preparation function.
 *
 * Answer preparation mutates ctx.answers in place. That is intentional: hooks,
 * validation, reachability, and render all run against the same request context
 * and need to observe the same answer history.
 */
export interface AnswerPreparationContext {
  answers: Record<string, { current: unknown; mutations: { value: unknown; source: string }[] }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
  post: Record<string, string | string[]>
}

export type ReachabilityContext = BasePhaseContext
