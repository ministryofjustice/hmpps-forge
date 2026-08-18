import type { WorkTask } from '../../../chassis/contracts/work/work.type'
import type { CurrentStepValidationWorkTask } from '../../validation/contracts/ValidationWork.type'
import type { HookEffectWorkTask } from './HookEffectWork.type'

export interface SubmitLifecycleWorkProps {
  readonly hooks: readonly SubmitHookWorkTask[]
}

export interface SubmitHookWorkProps {
  /** Absent means the hook has no condition and always runs. */
  readonly when?: SubmitHookPredicateWorkTask
  /** Absent means no guards were authored and the hook proceeds. */
  readonly guards?: SubmitHookPredicateWorkTask
  /** Absent means the authored onAlways branch has no effects or outcomes. */
  readonly onAlways?: SubmitBranchWorkTask
  readonly validation?: CurrentStepValidationWorkTask
  readonly onValid?: SubmitBranchWorkTask
  readonly onInvalid?: SubmitBranchWorkTask
}

export interface SubmitHookPredicateWorkProps {
  readonly name: string
  readonly evaluate: () => boolean | Promise<boolean>
}

export interface SubmitBranchWorkProps {
  readonly name: SubmitBranchName
  /** Absent means the branch runs no effects. */
  readonly effects?: readonly HookEffectWorkTask[]
  /** Absent means the branch produces no outcome and always continues. */
  readonly next?: () => SubmitHookNextResult | Promise<SubmitHookNextResult>
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
