import type { StepRequest } from '../../../framework/types/request.type'
import type { HookLifecycleContext } from '../../compilation/hooks/HookLifecycleCompiler'
import FunctionRegistry from '../../registries/FunctionRegistry'
import type { JourneyInstanceDependencies } from '../../types/engine.type'
import RuntimeEvaluationContext, { RuntimeEvaluationGlobalState } from './RuntimeEvaluationContext'
import type { StepValidityResult } from '../types/StepValidityResult.type'

type CompiledRequestSnapshot = Record<string, unknown> & {
  url: string
  path: string
  method: StepRequest['method']
  headers: ReturnType<StepRequest['getAllHeaders']>
  cookies: ReturnType<StepRequest['getAllCookies']>
  state: ReturnType<StepRequest['getAllState']>
}

export interface CompiledBaseContext {
  answers: RuntimeEvaluationGlobalState['answers']
  data: RuntimeEvaluationGlobalState['data']
  session: Record<string, unknown>
  params: ReturnType<StepRequest['getParams']>
  query: ReturnType<StepRequest['getAllQuery']>
  request: CompiledRequestSnapshot
  conditions: FunctionRegistry
}

export interface CompiledAnswerPreparationContext extends CompiledBaseContext {
  post: ReturnType<StepRequest['getAllPost']>
}

export interface CompiledRenderContext extends CompiledBaseContext {
  post: ReturnType<StepRequest['getAllPost']>
}

/**
 * Compiled functions deliberately receive a small serialisable-ish snapshot of
 * request state instead of the full RuntimeEvaluationContext. That keeps the
 * generated-function boundary explicit and prevents controller-specific objects
 * leaking into codegen as the compiler surface changes.
 */
export function buildCompiledBaseContext(
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
): CompiledBaseContext {
  const request = context.request

  return {
    answers: context.global.answers,
    data: context.global.data,
    session: (request.getSession() ?? {}) as Record<string, unknown>,
    params: request.getParams(),
    query: request.getAllQuery(),
    request: {
      url: request.url,
      path: request.location.pathname,
      method: request.method,
      headers: request.getAllHeaders(),
      cookies: request.getAllCookies(),
      state: request.getAllState(),
    },
    conditions: functionRegistry,
  }
}

export function buildCompiledAnswerPreparationContext(
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
): CompiledAnswerPreparationContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
    post: context.request.getAllPost(),
  }
}

export function buildCompiledRenderContext(
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
): CompiledRenderContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
    post: context.request.getAllPost(),
  }
}

export function buildCompiledHookLifecycleContext(
  context: RuntimeEvaluationContext,
  dependencies: JourneyInstanceDependencies,
  validate?: (groups: string[]) => StepValidityResult | Promise<StepValidityResult>,
): HookLifecycleContext {
  return {
    ...buildCompiledBaseContext(context, dependencies.functionRegistry),
    validation: context.global.validation,
    post: context.request.getAllPost(),
    logger: dependencies.logger,
    validate,
    effectContext: {
      global: context.global,
      request: context.request,
      response: context.response,
    },
  }
}
