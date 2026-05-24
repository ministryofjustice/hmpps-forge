import type { ForgeLifecycleEvent } from './types'

const LIFECYCLE_EVENT_TYPES = new Set(['journey-registered', 'registration-error'])

export function isForgeLifecycleEvent(trace: unknown): trace is ForgeLifecycleEvent {
  return typeof trace === 'object' &&
    trace !== null &&
    'type' in trace &&
    LIFECYCLE_EVENT_TYPES.has((trace as ForgeLifecycleEvent).type)
}
