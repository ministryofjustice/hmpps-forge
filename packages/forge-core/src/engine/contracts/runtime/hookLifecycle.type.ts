import type FunctionRegistry from '../../registries/FunctionRegistry'
import type { AnswerHistory } from './answerHistory.type'
import type { StepValidationState } from './evaluationState.type'
import type { StepValidityResult } from './stepValidityResult.type'
import type { ForgeInstrumentation } from '../../../instrumentation/ForgeInstrumentation'

export interface HookLifecycleContext {
  answers: Record<string, AnswerHistory>
  data: Record<string, unknown>
  validation?: StepValidationState
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  post: Record<string, string | string[]>
  request: Record<string, unknown>
  conditions: FunctionRegistry
  instrumentation: ForgeInstrumentation
  effectFunctionContext: unknown
  validate?: (groups: string[]) => StepValidityResult | Promise<StepValidityResult>
}

export interface CompiledAccessHookResult {
  executed: boolean
  outcome: 'continue' | 'redirect' | 'error'
  redirect?: string
  status?: number
  message?: string
}

export interface CompiledSubmitHookResult {
  executed: boolean
  validated: boolean
  isValid?: boolean
  outcome: 'continue' | 'redirect' | 'error'
  redirect?: string
  status?: number
  message?: string
}

export type CompiledAccessHookFunction = (
  ctx: HookLifecycleContext,
) => CompiledAccessHookResult | Promise<CompiledAccessHookResult>

export type CompiledAccessLifecycleFunction = (
  ctx: HookLifecycleContext,
) => CompiledAccessHookResult | Promise<CompiledAccessHookResult>

export type CompiledSubmitHooksFunction = (
  ctx: HookLifecycleContext,
) => CompiledSubmitHookResult | Promise<CompiledSubmitHookResult>
