export interface IteratorScopeFrame {
  itemVar: string
  indexVar: string
  rawItemExpr: string
  codeVar?: string
}

export interface NodeCompilationContext {
  compileOperand(value: unknown): string
  compileFunctionCall(funcName: string, argExprs: string[]): string
  namespaceToCtx(namespace: string): string
  readonly iteratorStack: readonly IteratorScopeFrame[]
}
