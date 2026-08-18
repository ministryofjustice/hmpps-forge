import type { CompiledBaseContext } from '../../../chassis/contracts/compiled/compiledContexts.type'
import type { AnswerHistory } from '../../../chassis/contracts/runtime/answerHistory.type'

export interface CompiledHookLifecycleContext extends CompiledBaseContext {
  answers: Record<string, AnswerHistory>
  post: Record<string, unknown>
  effectFunctionContext: unknown
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

interface CompiledAccessLifecycleWorkTask {
  readonly $$typeof: symbol
  readonly key: string
  readonly handler: unknown
  readonly props: unknown
}

interface CompiledSubmitHooksWorkTask {
  readonly $$typeof: symbol
  readonly key: string
  readonly handler: unknown
  readonly props: unknown
}

export type CompiledAccessLifecycleFunction = (
  ctx: CompiledHookLifecycleContext,
) => CompiledAccessLifecycleWorkTask | Promise<CompiledAccessLifecycleWorkTask>

export type CompiledSubmitHooksFunction = (
  ctx: CompiledHookLifecycleContext,
) => CompiledSubmitHooksWorkTask | Promise<CompiledSubmitHooksWorkTask>
