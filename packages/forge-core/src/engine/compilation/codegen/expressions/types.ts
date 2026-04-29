export interface IteratorScopeFrame {
  itemVar: string
  indexVar: string
  inputLengthExpr: string
  rawItemExpr: string
}

export interface NodeCompilationContext {
  compileOperand(value: unknown): string
  compileFunctionCall(funcName: string, argExprs: string[], source?: unknown): string
  namespaceToCtx(namespace: string): string
  readonly iteratorStack: readonly IteratorScopeFrame[]
  readonly selfCodeExpr: string | undefined
}
