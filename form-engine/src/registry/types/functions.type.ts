// Export types for registry entries
export type FunctionEvaluator<T = any> = (...args: any[]) => T

export interface FunctionRegistryEntry {
  name: string
  evaluate: FunctionEvaluator
}

export type FunctionRegistryObject = Record<string, FunctionRegistryEntry>

// TODO: This is just a stand in, replace with proper version when thunks are done
export type FormEffectContext = {
  getAnswer(fieldCode: string): any
  setAnswer(fieldCode: string, value: any): void
  setAnswers(answersObject: Record<string, any>): void
}
