// Export types for registry entries
export type FunctionEvaluator<T = any> = (...args: any[]) => T

export interface FunctionRegistryEntry {
  name: string
  evaluate: FunctionEvaluator
  isAsync: boolean
}

export type FunctionRegistryObject = Record<string, FunctionRegistryEntry>
