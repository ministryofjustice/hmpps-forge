import type { WorkTask } from '../../../contracts/work/work.type'
import type { HookEffectWorkTask } from './HookEffectWork.type'

export interface AccessLifecycleWorkProps {
  readonly hooks: readonly AccessHookWorkTask[]
}

export interface AccessHookWorkProps {
  /** Absent means the hook has no condition and always runs. */
  readonly when?: AccessHookWhenWorkTask
  /** Absent means the hook runs no effects. */
  readonly effects?: readonly HookEffectWorkTask[]
  /** Absent means the hook produces no outcome and always continues. */
  readonly next?: () => AccessHookNextResult | Promise<AccessHookNextResult>
}

export interface AccessHookWhenWorkProps {
  readonly evaluate: () => boolean | Promise<boolean>
}

export interface AccessHookNextWorkProps {
  readonly next: () => AccessHookNextResult | Promise<AccessHookNextResult>
}

export type AccessHookNextResult =
  | { readonly type: 'redirect'; readonly value: string }
  | { readonly type: 'error'; readonly value: { readonly status: number; readonly message: string } }
  | undefined

export type AccessLifecycleWorkTask = WorkTask<'access.lifecycle', AccessLifecycleWorkProps>

export type AccessHookWorkTask = WorkTask<'access.hook', AccessHookWorkProps>

type AccessHookWhenWorkTask = WorkTask<'access.hook.when', AccessHookWhenWorkProps>
