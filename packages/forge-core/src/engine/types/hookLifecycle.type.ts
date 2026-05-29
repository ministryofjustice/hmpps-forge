import type FunctionRegistry from '../registries/FunctionRegistry'
import type { EffectEvaluationContext } from '../runtime/context/EffectFunctionContext'
import type { StepValidationState } from '../runtime/context/RuntimeEvaluationContext'
import type { StepValidityResult } from '../runtime/types/StepValidityResult.type'
import type { ForgeInstrumentation } from '../../instrumentation/ForgeInstrumentation'

export interface HookLifecycleContext {
  answers: EffectEvaluationContext['global']['answers']
  data: Record<string, unknown>
  validation?: StepValidationState
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  post: Record<string, string | string[]>
  request: Record<string, unknown>
  conditions: FunctionRegistry
  instrumentation: ForgeInstrumentation
  effectContext: EffectEvaluationContext
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

export type CompiledAccessLifecycleFunction = (
  ctx: HookLifecycleContext,
) => CompiledAccessHookResult | Promise<CompiledAccessHookResult>

export type CompiledSubmitHooksFunction = (
  ctx: HookLifecycleContext,
) => CompiledSubmitHookResult | Promise<CompiledSubmitHookResult>
