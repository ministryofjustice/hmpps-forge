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

  /**
   * Indicates that the generated expression body has async dependencies.
   *
   * Expression compilers use this to emit awaitable wrappers while preserving
   * the same expression-shaped contract for sync and async source.
   */
  readonly usesAwait: boolean
}
