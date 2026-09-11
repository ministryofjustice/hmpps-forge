import type { AuthoredValue } from '../../../contracts/models/authoredValue.type'
import { CodeFragment } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'

export interface IteratorScopeFrame {
  readonly itemVar: IdentifierName
  readonly indexVar: IdentifierName
  readonly inputLengthExpr: CodeFragment | IdentifierName
  readonly inputWasKeyedVar: IdentifierName
  readonly rawItemExpr: CodeFragment | IdentifierName
}

export interface FunctionCallCompileOptions {
  readonly argumentPrefixes?: readonly string[]
}

export interface NodeCompilationContext {
  compileValueCode(value: AuthoredValue, generator?: CodeGenerator): CodeFragment
  compileMatchPredicateCode(value: AuthoredValue, subject: CodeFragment): CodeFragment
  withIteratorFrame<T>(frame: IteratorScopeFrame, compile: () => T): T
  compileFunctionCallCode(
    funcName: string,
    argExprs: readonly CodeFragment[],
    source?: unknown,
    options?: FunctionCallCompileOptions,
  ): CodeFragment
  namespaceToCtxCode(namespace: string): CodeFragment
  readonly generator: CodeGenerator
  readonly iteratorStack: readonly IteratorScopeFrame[]
  readonly selfCodeExpr: CodeFragment | undefined

  /** Whether the generated function requires an async wrapper to await possible promise results. */
  readonly usesAwait: boolean
}
