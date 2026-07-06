import type { ZodType } from 'zod'
import type { FunctionType } from './enums'

// Export types for registry entries
export type FunctionEvaluator<T = any> = (...args: any[]) => T

export interface FunctionRegistryEntry {
  name: string
  evaluate: FunctionEvaluator
  isAsync: boolean
  inputSchema?: ZodType
  argumentsSchema?: ZodType
  outputSchema?: ZodType
  functionType?: FunctionType
}

export type FunctionRegistryObject = Record<string, FunctionRegistryEntry>
