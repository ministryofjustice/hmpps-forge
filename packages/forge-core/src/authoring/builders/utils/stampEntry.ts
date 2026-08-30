/** The surface a stamp needs: any callable will do. */
type EntryFunction = (...args: any[]) => unknown

/**
 * Attaches a function entry to an expression as a non-enumerable `__entry`.
 * The reference is the identity - the engine dedupes entries by it - so the
 * stamp always holds the entry function itself, never a copy.
 * configurable + writable so finalisation walks can re-stamp copies.
 */
export const stampEntry = (target: unknown, entry: EntryFunction): void => {
  if (target === null || typeof target !== 'object') {
    return
  }

  Object.defineProperty(target, '__entry', {
    value: entry,
    enumerable: false,
    configurable: true,
    writable: true,
  })
}

/**
 * Reads the function entry stamped onto an expression, if any.
 */
export const getEntryStamp = (value: unknown): EntryFunction | undefined => {
  if (value === null || typeof value !== 'object') {
    return undefined
  }

  return Object.getOwnPropertyDescriptor(value, '__entry')?.value as EntryFunction | undefined
}
