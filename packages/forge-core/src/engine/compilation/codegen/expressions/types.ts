import type { GeneratedFunctionHelpers } from '../generated-functions/GeneratedFunctionHelpers'

export interface IteratorScopeFrame {
  itemVar: string
  indexVar: string
  inputLengthExpr: string
  rawItemExpr: string
}

export interface NodeCompilationContext {
  compileOperand(value: unknown): string
  compileFunctionCall(funcName: string, argExprs: string[], source?: unknown): string
  compileHelperCall(helperName: keyof GeneratedFunctionHelpers, argExprs: string[]): string
  namespaceToCtx(namespace: string): string
  readonly iteratorStack: readonly IteratorScopeFrame[]
  readonly selfCodeExpr: string | undefined
}
