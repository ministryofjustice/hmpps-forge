// Export types for registry entries
export type FunctionEvaluator<T = any> = (...args: any[]) => T

export interface FunctionRegistryEntry {
  name: string
  evaluate: FunctionEvaluator
  isAsync: boolean
}

export type FunctionRegistryObject = Record<string, FunctionRegistryEntry>

/**
 * Detect if a function is async by checking its constructor
 *
 * Returns true for:
 * - async function declarations: async function foo() {}
 * - async arrow functions: async () => {}
 * - async methods: async foo() {}
 *
 * Returns false for:
 * - Regular functions that return Promises (requires async keyword)
 */
export function isAsyncFunction(fn: (...args: any[]) => any): boolean {
  return fn.constructor.name === 'AsyncFunction'
}
