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

/**
 * Attaches a component to a block definition as a non-enumerable `__component`.
 * The reference is the identity - collection dedupes components by it - so the
 * stamp always holds the component itself, never a copy.
 * configurable + writable so finalisation walks can re-stamp copies.
 */
export const stampComponent = (target: unknown, component: EntryFunction): void => {
  if (target === null || typeof target !== 'object') {
    return
  }

  Object.defineProperty(target, '__component', {
    value: component,
    enumerable: false,
    configurable: true,
    writable: true,
  })
}

/**
 * Reads the component stamped onto a block definition, if any.
 */
export const getComponentStamp = (value: unknown): EntryFunction | undefined => {
  if (value === null || typeof value !== 'object') {
    return undefined
  }

  return Object.getOwnPropertyDescriptor(value, '__component')?.value as EntryFunction | undefined
}
