export interface Callsite {
  readonly stack?: string
}

/**
 * Captures the caller's stack without formatting it: V8 defines `.stack` as a
 * lazy accessor, so the (expensive) trace formatting only happens if something
 * actually reads it. Do not read `.stack` here.
 *
 * @param skip - Frames above this function are kept; it and everything below are dropped
 */
export const captureCallsite = (skip: (...args: any[]) => unknown): Callsite => {
  if (typeof Error.captureStackTrace !== 'function') {
    return {}
  }

  const site: Callsite = {}
  const previousLimit = Error.stackTraceLimit

  Error.stackTraceLimit = 5
  try {
    Error.captureStackTrace(site, skip)
  } finally {
    Error.stackTraceLimit = previousLimit
  }

  return site
}

/**
 * Attaches a captured callsite to an object as a non-enumerable `__callsite`.
 * configurable + writable so finalisation walks can re-stamp copies.
 */
export const stampCallsite = (target: unknown, callsite: Callsite): void => {
  if (target === null || typeof target !== 'object' || !('stack' in callsite)) {
    return
  }

  Object.defineProperty(target, '__callsite', {
    value: callsite,
    enumerable: false,
    configurable: true,
    writable: true,
  })
}
