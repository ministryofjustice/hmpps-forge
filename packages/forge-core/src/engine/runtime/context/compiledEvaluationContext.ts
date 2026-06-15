import type { StepRequest } from '../../../framework/types/request.type'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import type { HookLifecycleContext } from '../../contracts/compiled/phaseContexts.type'
import type { HookType } from '../../contracts/runtime/answerHistory.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import RuntimeEvaluationContext from './RuntimeEvaluationContext'
import EffectFunctionContextImpl from './EffectFunctionContext'
import type { RuntimeEvaluationGlobalState } from '../../contracts/runtime/evaluationState.type'
import type { StepValidityResult } from '../../contracts/runtime/stepValidityResult.type'
import type TraceRecorder from '../pipeline/trace/TraceRecorder'
import TracingFunctionRegistry from '../pipeline/trace/TracingFunctionRegistry'

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
  trace?: TraceRecorder,
): CompiledBaseContext {
  const request = context.request
  const conditions = trace ? new TracingFunctionRegistry(functionRegistry, trace) : functionRegistry

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
    conditions,
  }
}

export function buildCompiledAnswerPreparationContext(
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
  trace?: TraceRecorder,
): CompiledAnswerPreparationContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry, trace),
    post: context.request.getAllPost(),
  }
}

export function buildCompiledRenderContext(
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
  trace?: TraceRecorder,
): CompiledRenderContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry, trace),
    post: context.request.getAllPost(),
  }
}

export function buildCompiledHookLifecycleContext(
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
  hookType: HookType,
  responseBindings: ResponseBindings,
  validate?: (groups: string[]) => StepValidityResult | Promise<StepValidityResult>,
  trace?: TraceRecorder,
): HookLifecycleContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry, trace),
    validation: context.global.validation,
    post: context.request.getAllPost(),
    validate,
    effectFunctionContext: new EffectFunctionContextImpl(
      { global: context.global, request: context.request, response: responseBindings },
      hookType,
    ),
    runEffect: async (_name, thunk) => {
      await thunk()
    },
  }
}
