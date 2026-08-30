import type { ResponseBindings } from '../../../../framework/types/responseBindings.type'
import type {
  CompiledAnswerPreparationContext,
  CompiledBaseContext,
  CompiledReachabilityContext,
  CompiledResolveContext,
  CompiledRouteMetadataContext,
  CompiledValidationContext,
} from '../../contracts/compiled/compiledContexts.type'
import type { CompiledHookLifecycleContext } from '../../../concerns/hooks/contracts/hookLifecycle.type'
import type { ValidationResult } from '../../../concerns/validation/contracts/validationResult.type'
import type { HookType } from '../../contracts/runtime/answerHistory.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'
import EffectFunctionContextImpl from './EffectFunctionContext'
import { createAnswerPreparationTask } from '../../../concerns/answer-preparation/runtime/AnswerPreparationWorkHandler'
import { createFieldAnswerPreparationTask } from '../../../concerns/answer-preparation/runtime/FieldAnswerPreparationWorkHandler'
import { createStepValidationTask } from '../../../concerns/validation/runtime/StepValidationWorkHandler'
import { createFieldValidationTask } from '../../../concerns/validation/runtime/FieldValidationWorkHandler'
import { createDomainValidationTask } from '../../../concerns/validation/runtime/DomainValidationWorkHandler'
import { createCurrentStepValidationTask } from '../../../concerns/validation/runtime/CurrentStepValidationWorkHandler'
import { createResolveBlockTask } from '../../../concerns/resolve/runtime/ResolveBlockWorkHandler'
import { createResolveBlocksTask } from '../../../concerns/resolve/runtime/ResolveBlocksWorkHandler'
import { createAccessLifecycleTask } from '../../../concerns/hooks/runtime/AccessLifecycleWorkHandler'
import { createAccessHookTask } from '../../../concerns/hooks/runtime/AccessHookWorkHandler'
import { createAccessHookWhenTask } from '../../../concerns/hooks/runtime/AccessHookWhenWorkHandler'
import { createHookEffectTask } from '../../../concerns/hooks/runtime/HookEffectWorkHandler'
import { createSubmitLifecycleTask } from '../../../concerns/hooks/runtime/SubmitLifecycleWorkHandler'
import { createSubmitHookTask } from '../../../concerns/hooks/runtime/SubmitHookWorkHandler'
import { createSubmitPredicateTask } from '../../../concerns/hooks/runtime/SubmitHookPredicateWorkHandler'
import { createSubmitBranchTask } from '../../../concerns/hooks/runtime/SubmitBranchWorkHandler'
import IteratorBudget from '../pipeline/IteratorBudget'
import type { IteratorBudgetContract } from '../../contracts/runtime/iteratorBudget.type'
import type { NodeId } from '../../contracts/ast/ast.type'
import type { CompiledValidationFunction } from '../../contracts/compiled/compiledFunctions.type'
import type { ValidationRuleFilter } from '../../../concerns/validation/contracts/ValidationWork.type'

/**
 * The task-construction surface handed to generated functions as `ctx.workTasks`.
 * Generated source calls these by property name, so the names are part of the
 * codegen contract and must not change without changing the emitters.
 */
export const workTaskBuilders = {
  answerPreparation: createAnswerPreparationTask,
  fieldAnswerPreparation: createFieldAnswerPreparationTask,
  stepValidation: createStepValidationTask,
  fieldValidation: createFieldValidationTask,
  domainValidation: createDomainValidationTask,
  resolveBlock: createResolveBlockTask,
  resolveBlocks: createResolveBlocksTask,
  accessLifecycle: createAccessLifecycleTask,
  accessHook: createAccessHookTask,
  accessHookWhen: createAccessHookWhenTask,
  hookEffect: createHookEffectTask,
  submitLifecycle: createSubmitLifecycleTask,
  submitHook: createSubmitHookTask,
  submitPredicate: createSubmitPredicateTask,
  submitBranch: createSubmitBranchTask,
}

/**
 * Compiled functions deliberately receive a small serialisable-ish snapshot of
 * request state instead of the full RuntimeContext. That keeps the
 * generated-function boundary explicit and prevents controller-specific objects
 * leaking into codegen as the compiler surface changes.
 */
function buildCompiledBaseContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
  requestWorkTaskBuilders: unknown = workTaskBuilders,
): CompiledBaseContext {
  return {
    iteratorBudget: resolveIteratorBudget(context),
    answers: context.domain.answers,
    data: context.domain.data,
    session: context.request.session,
    params: context.request.params,
    query: context.request.query,
    post: context.request.post,
    request: { ...context.request },
    conditions: functionRegistry,
    workTasks: requestWorkTaskBuilders,
  }
}

function resolveIteratorBudget(context: RuntimeContext): IteratorBudgetContract {
  context.evaluation.iteratorBudget ??= new IteratorBudget()

  return context.evaluation.iteratorBudget
}

export function buildCompiledAnswerPreparationContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
): CompiledAnswerPreparationContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
    answers: context.domain.answers,
  }
}

export function buildCompiledResolveContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
  fieldFailures: Record<string, ValidationResult[]>,
  fieldFailureAnchors: Record<string, string>,
): CompiledResolveContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry),
    fieldFailures,
    fieldFailureAnchors,
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

export function buildCompiledAccessHookLifecycleContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
  responseBindings: ResponseBindings,
): CompiledHookLifecycleContext {
  return buildCompiledHookLifecycleContext(context, functionRegistry, 'access', responseBindings, workTaskBuilders)
}

export function buildCompiledSubmitHookLifecycleContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
  responseBindings: ResponseBindings,
  stepId: NodeId,
  compiledValidation: CompiledValidationFunction,
): CompiledHookLifecycleContext {
  const currentStepValidation = (key: string, filter: ValidationRuleFilter) =>
    createCurrentStepValidationTask(key, { ...filter, stepId, compiledValidation })
  const submitWorkTaskBuilders = { ...workTaskBuilders, currentStepValidation }

  return buildCompiledHookLifecycleContext(
    context,
    functionRegistry,
    'submit',
    responseBindings,
    submitWorkTaskBuilders,
  )
}

function buildCompiledHookLifecycleContext(
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
  hookType: HookType,
  responseBindings: ResponseBindings,
  requestWorkTaskBuilders: unknown,
): CompiledHookLifecycleContext {
  return {
    ...buildCompiledBaseContext(context, functionRegistry, requestWorkTaskBuilders),
    answers: context.domain.answers,
    effectFunctionContext: new EffectFunctionContextImpl(context, responseBindings, hookType),
  }
}
