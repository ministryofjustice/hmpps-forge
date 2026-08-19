import type { WorkTask } from '../../../chassis/contracts/work/work.type'

export interface HookEffectWorkProps {
  readonly name: string
  readonly run: () => void | Promise<void>
}

export type HookEffectWorkTask = WorkTask<'hook.effect', HookEffectWorkProps>
