import { CodeFragment } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'

export interface IteratorScopeFrame {
  readonly itemVar: IdentifierName
  readonly indexVar: IdentifierName
  readonly inputLengthExpr: CodeFragment | IdentifierName
  readonly rawItemExpr: CodeFragment | IdentifierName
}

export interface FunctionCallCompileOptions {
  readonly argumentPrefixes?: readonly string[]
}

export interface NodeCompilationContext {
  compileOperandCode(value: unknown): CodeFragment
  compileFunctionCallCode(
    funcName: string,
    argExprs: readonly CodeFragment[],
    source?: unknown,
    options?: FunctionCallCompileOptions,
  ): CodeFragment
  /**
   * Compiles a sub-expression with call hoisting disabled. Node compilers must
   * use this for any position that evaluates conditionally or lands inside a
   * nested function scope, so hoisted call statements cannot escape it.
   */
  withoutCallHoisting<T>(compile: () => T): T
  namespaceToCtxCode(namespace: string): CodeFragment
  readonly generator: CodeGenerator
  readonly iteratorStack: readonly IteratorScopeFrame[]
  readonly selfCodeExpr: CodeFragment | undefined

  /**
   * True when the generated expression body contains async function calls.
   *
   * Expression compilers use this to decide whether to wrap results in
   * `await` while still producing a single expression for both sync and
   * async cases.
   */
  readonly usesAwait: boolean
}
