import type { ResponseBindings } from '../../../../framework/types/responseBindings.type'
import type {
  CompiledAnswerPreparationContext,
  CompiledBaseContext,
  CompiledReachabilityContext,
  CompiledResolveContext,
  CompiledRouteMetadataContext,
  CompiledValidationContext,
} from '../../../contracts/compiled/compiledContexts.type'
import type { CompiledHookLifecycleContext } from '../../../contracts/runtime/hookLifecycle.type'
import type { ValidationResult } from '../../../contracts/runtime/validationResult.type'
import type { HookType } from '../../../contracts/runtime/answerHistory.type'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'
import EffectFunctionContextImpl from './EffectFunctionContext'
import WorkTaskFactory from '../work/WorkTaskFactory'

/**
 * Compiled functions deliberately receive a small serialisable-ish snapshot of
 * request state instead of the full RuntimeContext. That keeps the
 * generated-function boundary explicit and prevents controller-specific objects
 * leaking into codegen as the compiler surface changes.
 */
export function buildCompiledBaseContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
): CompiledBaseContext {
  return {
    answers: context.domain.answers,
    data: context.domain.data,
    session: context.request.session,
    params: context.request.params,
    query: context.request.query,
    request: { ...context.request },
    conditions: functionRegistry,
    workTasks: WorkTaskFactory,
  }
}

export function buildCompiledAnswerPreparationContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
): CompiledAnswerPreparationContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
    answers: context.domain.answers,
    post: context.request.post,
  }
}

export function buildCompiledResolveContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
  fieldFailures: Record<string, ValidationResult[]>,
): CompiledResolveContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
    post: context.request.post,
    fieldFailures,
  }
}

export function buildCompiledValidationContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
): CompiledValidationContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
  }
}

export function buildCompiledReachabilityContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
): CompiledReachabilityContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
  }
}

export function buildCompiledRouteMetadataContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
): CompiledRouteMetadataContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
  }
}

export function buildCompiledHookLifecycleContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
  hookType: HookType,
  responseBindings: ResponseBindings,
): CompiledHookLifecycleContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
    answers: context.domain.answers,
    post: context.request.post,
    effectFunctionContext: new EffectFunctionContextImpl(context, responseBindings, hookType),
  }
}
