import type { WorkTask } from '../../../contracts/runtime/work.type'
import type { HookEffectWorkTask } from './HookEffectWork.type'

export interface SubmitLifecycleWorkProps {
  readonly hooks: readonly SubmitHookWorkTask[]
}

export interface SubmitHookWorkProps {
  readonly when: SubmitHookPredicateWorkTask
  readonly guards: SubmitHookPredicateWorkTask
  readonly onAlways: SubmitBranchWorkTask
  readonly validation?: SubmitValidationWorkTask
  readonly onValid?: SubmitBranchWorkTask
  readonly onInvalid?: SubmitBranchWorkTask
}

export interface SubmitHookPredicateWorkProps {
  readonly name: string
  readonly evaluate: () => boolean | Promise<boolean>
}

export interface SubmitBranchWorkProps {
  readonly name: SubmitBranchName
  readonly effects: readonly HookEffectWorkTask[]
  readonly groups: readonly string[]
  readonly next: () => SubmitHookNextResult | Promise<SubmitHookNextResult>
}

export interface SubmitValidationWorkProps {
  readonly groups: readonly string[]
}

export type SubmitBranchName = 'onAlways' | 'onValid' | 'onInvalid'

export type SubmitHookNextResult =
  | { readonly type: 'redirect'; readonly value: string }
  | { readonly type: 'error'; readonly value: { readonly status: number; readonly message: string } }
  | undefined

export type SubmitLifecycleWorkTask = WorkTask<'submit.lifecycle', SubmitLifecycleWorkProps>

export type SubmitHookWorkTask = WorkTask<'submit.hook', SubmitHookWorkProps>

type SubmitHookPredicateWorkTask = WorkTask<'submit.predicate', SubmitHookPredicateWorkProps>

type SubmitBranchWorkTask = WorkTask<'submit.branch', SubmitBranchWorkProps>

type SubmitValidationWorkTask = WorkTask<'submit.validation', SubmitValidationWorkProps>
